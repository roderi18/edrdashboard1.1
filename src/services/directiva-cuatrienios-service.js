import { doc, query, where, getDoc, getDocs, deleteDoc, collection, writeBatch } from 'firebase/firestore';

import { uploadOptimizedImage } from 'src/utils/firebase-image-storage';
import { puedeEditarDirectivaHistorica } from 'src/utils/org-level-access';
import { leerConCache, valorGuardado, avisarAOtrasSesiones } from 'src/utils/cache-de-lecturas.mjs';
import {
  cargoPorId,
  permanenciaDe,
  nombreCompleto,
  compararIntegrantes,
  COLECCION_PERMANENTES,
  COLECCION_INTEGRANTES,
} from 'src/utils/directiva-cuatrienios.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';

import { authHeaders } from './member-service';
import { AMBITOS_CAMBIO, proponerCambio } from './solicitudes-cambio-service';
import { notificarCambioDirectivaHistorica } from './notificar-oficina-nacional-service';

// ----------------------------------------------------------------------
// La Directiva Nacional por cuatrienio, en Firestore.
//
// Tres colecciones (reglas en `firestore.rules`):
//  - `directiva_cuatrienios_integrantes`: una fila por casilla ocupada. El id sale
//    de la casilla (`idIntegrante`), asi que volver a guardarla la reemplaza.
//  - `directiva_nacional_permanentes/{idMiembros}`: lo que la persona conserva
//    para siempre (Director Nacional, ex comandante). Lo lee el servidor al
//    calcular el rol; se recalcula aqui cada vez que cambia una fila suya.
//
// Solo escriben el Administrador Global y la Oficina Nacional. Cada cambio queda
// en Historial y avisa al otro.
// ----------------------------------------------------------------------

// La lista nacional abre ese cuatrienio con `?cuatrienio=`.
const rutaDelCuatrienio = (cuatrienio) =>
  `/dashboard/level/national?cuatrienio=${encodeURIComponent(cuatrienio)}`;
const CARPETA_FOTOS = 'directiva-historica';
// Firestore no admite mas de 500 escrituras por lote.
const TAMANO_LOTE = 400;

const asegurar = () => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado en este entorno.');
  }
};

const asegurarPermiso = (usuario) => {
  if (!puedeEditarDirectivaHistorica(usuario)) {
    throw new Error(
      'Solo el Administrador Global y la Oficina Nacional editan la Directiva por cuatrienio.'
    );
  }
};

const quienActua = (usuario = {}) => ({
  uid: String(usuario?.uid || usuario?.id || ''),
  nombre: String(usuario?.displayName || usuario?.name || usuario?.email || 'Usuario'),
});

// Solo los campos de la fila: un integrante que llega de la pantalla trae ademas
// cosas de pintar que no se guardan.
const aDocumento = (integrante = {}, usuario = {}) => {
  const actor = quienActua(usuario);

  return {
    id: integrante.id,
    cuatrienio: integrante.cuatrienio,
    nivel: integrante.nivel,
    grupo: integrante.grupo || 'directiva',
    cargo: integrante.cargo,
    cargoNombre: integrante.cargoNombre || '',
    idPosicionDirectiva: integrante.idPosicionDirectiva || null,
    orden: Number(integrante.orden) || cargoPorId(integrante.cargo)?.orden || 99,
    regionId: integrante.regionId ? String(integrante.regionId) : '',
    regionNombre: integrante.regionNombre || '',
    seccionId: integrante.seccionId ? String(integrante.seccionId) : '',
    seccionNombre: integrante.seccionNombre || '',
    idMiembros: integrante.idMiembros ? String(integrante.idMiembros) : '',
    codigoMiembro: integrante.codigoMiembro || '',
    nombres: String(integrante.nombres || '').trim(),
    apellidos: String(integrante.apellidos || '').trim(),
    fotoUrl: integrante.fotoUrl || '',
    fotoRuta: integrante.fotoRuta || '',
    desde: integrante.desde || null,
    hasta: integrante.hasta || null,
    nota: integrante.nota || '',
    actualizadoPorUid: actor.uid,
    actualizadoPorNombre: actor.nombre,
    actualizadoEn: new Date().toISOString(),
  };
};

// ----------------------------------------------------------------------
// Lectura.
// ----------------------------------------------------------------------

// Las lecturas pasan por la caché de lecturas: volver a un cuatrienio ya visto
// lo pinta al momento. Todas las escrituras de este archivo van por
// `proponerCambio`, que la invalida al aplicar.
const claveDelCuatrienio = (cuatrienio) => `cuatrienio:integrantes:${cuatrienio}`;

export const obtenerIntegrantesDelCuatrienio = (cuatrienio) =>
  leerConCache(claveDelCuatrienio(cuatrienio), () => leerIntegrantesDelCuatrienio(cuatrienio));

/** Integrantes ya leídos de un cuatrienio, o `undefined` (para el primer render). */
export const integrantesGuardadosDelCuatrienio = (cuatrienio) =>
  valorGuardado(claveDelCuatrienio(cuatrienio));

async function leerIntegrantesDelCuatrienio(cuatrienio) {
  asegurar();

  const snapshot = await getDocs(
    query(
      collection(FIRESTORE, COLECCION_INTEGRANTES),
      where('cuatrienio', '==', String(cuatrienio))
    )
  );

  return snapshot.docs.map((fila) => ({ id: fila.id, ...fila.data() })).sort(compararIntegrantes);
}

/** Lee una sola ficha de la memoria, sin consultar el perfil real del miembro. */
export async function obtenerIntegranteDelCuatrienioPorId(cuatrienio, idIntegrante) {
  asegurar();
  if (!cuatrienio || !idIntegrante) return null;

  const snapshot = await getDoc(doc(FIRESTORE, COLECCION_INTEGRANTES, String(idIntegrante)));
  if (!snapshot.exists()) return null;

  const integrante = { id: snapshot.id, ...snapshot.data() };
  return String(integrante.cuatrienio) === String(cuatrienio) ? integrante : null;
}

// Todos los que conservan algo para siempre. La lista nacional los usa para que
// los ex comandantes salgan siempre en el Consejo Ejecutivo.
export const obtenerPermanentes = () => leerConCache('cuatrienio:permanentes', leerPermanentes);

async function leerPermanentes() {
  if (!isFirebaseConfigured || !FIRESTORE) return [];

  const snapshot = await getDocs(collection(FIRESTORE, COLECCION_PERMANENTES));

  return snapshot.docs.map((fila) => ({ idMiembros: fila.id, ...fila.data() }));
}

// ----------------------------------------------------------------------
// Lo permanente.
// ----------------------------------------------------------------------

const recalcularPermanentes = async (idsMiembros = []) => {
  const ids = [...new Set(idsMiembros.map((id) => String(id || '').trim()).filter(Boolean))];

  await Promise.all(
    ids.map(async (idMiembros) => {
      const snapshot = await getDocs(
        query(collection(FIRESTORE, COLECCION_INTEGRANTES), where('idMiembros', '==', idMiembros))
      );
      const filas = snapshot.docs.map((fila) => fila.data());
      const permanencia = permanenciaDe(filas);
      const referencia = doc(FIRESTORE, COLECCION_PERMANENTES, idMiembros);

      // Todo esto corre DENTRO de `aplicar` de `proponerCambio`: el cambio ya
      // quedo en Historial.
      if (!permanencia.permisosDirectorNacional) {
        // eslint-disable-next-line no-restricted-syntax
        await deleteDoc(referencia).catch(() => {});
        return;
      }

      // La cara y el nombre de la fila mas reciente: salen en el Consejo
      // Ejecutivo sin tener que ir a buscar el cuatrienio.
      const [fila] = [...filas].sort((a, b) => String(b.cuatrienio).localeCompare(a.cuatrienio));
      // eslint-disable-next-line no-restricted-syntax
      const lote = writeBatch(FIRESTORE);

      lote.set(referencia, {
        idMiembros,
        ...permanencia,
        nombres: fila?.nombres || '',
        apellidos: fila?.apellidos || '',
        fotoUrl: fila?.fotoUrl || '',
        codigoMiembro: fila?.codigoMiembro || '',
        cuatrienios: [...new Set(filas.map((f) => f.cuatrienio).filter(Boolean))].sort(),
        actualizadoEn: new Date().toISOString(),
      });

      await lote.commit();
    })
  );
};

// ----------------------------------------------------------------------
// Escritura.
// ----------------------------------------------------------------------

const escribirEnLotes = async (operaciones = []) => {
  for (let inicio = 0; inicio < operaciones.length; inicio += TAMANO_LOTE) {
    // Solo se llama desde `aplicar` de `proponerCambio`: ya esta en Historial.
    // eslint-disable-next-line no-restricted-syntax
    const lote = writeBatch(FIRESTORE);

    operaciones.slice(inicio, inicio + TAMANO_LOTE).forEach((operacion) => operacion(lote));
    // En serie a proposito: son pocos lotes y asi un fallo no deja medio listado
    // escrito por delante del que fallo.
    await lote.commit();
  }
};

/**
 * Guarda una o varias filas de un cuatrienio.
 *
 * `anteriores` son las filas que se reemplazan (mismo id o cambio de persona):
 * sirven para el Historial y para recalcular lo permanente de quien sale.
 */
export async function guardarIntegrantes({
  cuatrienio,
  integrantes = [],
  anteriores = [],
  usuario,
  descripcion = '',
}) {
  asegurar();
  asegurarPermiso(usuario);

  const filas = integrantes.map((integrante) => aDocumento({ ...integrante, cuatrienio }, usuario));

  if (!filas.length) return { guardados: 0 };

  const texto =
    descripcion ||
    (filas.length === 1
      ? `${quienActua(usuario).nombre} guardó a ${nombreCompleto(filas[0])} como ${filas[0].cargoNombre} en la Directiva ${cuatrienio}.`
      : `${quienActua(usuario).nombre} guardó ${filas.length} integrantes en la Directiva ${cuatrienio}.`);

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.directivaHistorica,
    entidad: {
      tipo: 'directiva_cuatrienio',
      id: cuatrienio,
      nombre: `Directiva ${cuatrienio}`,
      ruta: rutaDelCuatrienio(cuatrienio),
    },
    cambios:
      filas.length === 1
        ? [
            {
              campo: filas[0].id,
              etiqueta: filas[0].cargoNombre,
              antes: anteriores[0] ? nombreCompleto(anteriores[0]) : null,
              despues: nombreCompleto(filas[0]),
            },
          ]
        : [{ campo: 'integrantes', etiqueta: 'Integrantes', antes: null, despues: filas.length }],
    usuario,
    descripcion: texto,
    aplicarDirecto: true,
    aplicar: async () => {
      await escribirEnLotes(
        filas.map(
          (fila) => (lote) => lote.set(doc(FIRESTORE, COLECCION_INTEGRANTES, fila.id), fila)
        )
      );
      await recalcularPermanentes([
        ...filas.map((fila) => fila.idMiembros),
        ...anteriores.map((fila) => fila?.idMiembros),
      ]);
    },
  });

  // Las demás sesiones releen la memoria del cuatrienio (ver `avisos-de-lecturas`).
  avisarAOtrasSesiones('cuatrienio:');

  notificarCambioDirectivaHistorica({ mensaje: texto, cuatrienio, usuario }).catch((error) => {
    console.warn('[directiva-cuatrienios] no se pudo avisar del cambio', error);
  });

  return { guardados: filas.length };
}

// Quitar una fila de la historia. Se pide confirmacion en la pantalla: la
// memoria no se borra sola.
export async function quitarIntegrante({ integrante, usuario }) {
  asegurar();
  asegurarPermiso(usuario);

  if (!integrante?.id) return;

  const texto = `${quienActua(usuario).nombre} quitó a ${nombreCompleto(integrante)} (${integrante.cargoNombre}) de la Directiva ${integrante.cuatrienio}.`;

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.directivaHistorica,
    entidad: {
      tipo: 'directiva_cuatrienio',
      id: integrante.cuatrienio,
      nombre: `Directiva ${integrante.cuatrienio}`,
      ruta: rutaDelCuatrienio(integrante.cuatrienio),
    },
    cambios: [
      {
        campo: integrante.id,
        etiqueta: integrante.cargoNombre,
        antes: nombreCompleto(integrante),
        despues: null,
      },
    ],
    usuario,
    descripcion: texto,
    aplicarDirecto: true,
    aplicar: async () => {
      // eslint-disable-next-line no-restricted-syntax
      await deleteDoc(doc(FIRESTORE, COLECCION_INTEGRANTES, integrante.id));
      await recalcularPermanentes([integrante.idMiembros]);
    },
  });

  // Las demás sesiones releen la memoria del cuatrienio (ver `avisos-de-lecturas`).
  avisarAOtrasSesiones('cuatrienio:');

  notificarCambioDirectivaHistorica({
    mensaje: texto,
    cuatrienio: integrante.cuatrienio,
    usuario,
  }).catch((error) => {
    console.warn('[directiva-cuatrienios] no se pudo avisar del cambio', error);
  });
}

// ----------------------------------------------------------------------
// Fotos congeladas.
// ----------------------------------------------------------------------

const rutaDeFoto = (cuatrienio, idIntegrante) =>
  `${CARPETA_FOTOS}/${cuatrienio}/${String(idIntegrante).replace(/[^a-zA-Z0-9_-]/g, '-')}.webp`;

/**
 * Copia la foto de perfil de HOY a la carpeta del cuatrienio y devuelve la copia.
 *
 * Copiar, no enlazar: al cambiar la foto de perfil, Storage reemplaza el archivo
 * y su enlace deja de servir, asi que la historia se quedaria sin cara o con la
 * nueva. La copia la hace el servidor porque el navegador no puede leer el
 * archivo de Storage (CORS); escribe con el token de quien lo pide, asi que las
 * reglas de Storage deciden igual que si subiera el archivo a mano.
 */
export async function congelarFotoDePerfil({ urlOrigen, cuatrienio, idIntegrante }) {
  if (!urlOrigen) return { fotoUrl: '', fotoRuta: '' };

  // No cambia ningun dato: deja una copia de la imagen en Storage. Lo que la usa
  // —la fila del cuatrienio— se guarda despues por `proponerCambio`.
  const respuesta = await fetch('/api/directiva-cuatrienios/congelar-foto', {
    // eslint-disable-next-line no-restricted-syntax
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ urlOrigen, ruta: rutaDeFoto(cuatrienio, idIntegrante) }),
  });
  const cuerpo = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new Error(cuerpo?.error || 'No se pudo copiar la foto.');
  }

  return { fotoUrl: cuerpo.fotoUrl || '', fotoRuta: cuerpo.fotoRuta || '' };
}

// Una foto elegida a mano para la historia (sobre todo del 2022-2026, que no
// tiene foto de perfil de la que partir).
export async function subirFotoDeIntegrante({ file, cuatrienio, idIntegrante }) {
  const subida = await uploadOptimizedImage({
    file,
    preset: 'avatar',
    storagePath: rutaDeFoto(cuatrienio, idIntegrante),
    metadata: { cuatrienio: String(cuatrienio), idIntegrante: String(idIntegrante) },
  });

  return { fotoUrl: subida.downloadUrl, fotoRuta: subida.storagePath };
}
