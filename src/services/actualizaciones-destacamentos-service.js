import { ref, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore';

import { FIRESTORE, FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';

import { getChurches } from './church-service';
import { updateDestApi, mapApiDestToUI, aplicarFotoDestacamento } from './dest-service';

// ----------------------------------------------------------------------
// ACTUALIZACIONES DE DESTACAMENTOS (`actualizaciones_destacamentos`).
//
// Las escribe la landing externa (por su servidor, con el Admin SDK) cuando un
// directivo registra o corrige un destacamento. NO entran solas en el padrón:
// quedan aquí hasta que el Administrador Global o la Oficina Nacional deciden
// cargarlas, cambiarlas o descartarlas. Se eligen con casillas en la
// bandeja y se cargan o descartan (más abajo).
// ----------------------------------------------------------------------

export const COLECCION_ACTUALIZACIONES_DESTACAMENTOS = 'actualizaciones_destacamentos';

export const ESTADOS_ACTUALIZACION = {
  pendiente: 'pendiente',
  cargada: 'cargada',
  descartada: 'descartada',
};

const aFecha = (valor) => {
  if (!valor) return null;
  if (typeof valor.toDate === 'function') return valor.toDate();
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

/**
 * Escucha los envíos en vivo (es una bandeja: lo nuevo debe aparecer sin
 * recargar). Devuelve la función para dejar de escuchar.
 */
export function escucharActualizacionesDeDestacamentos(alCambiar, alFallar) {
  if (!isFirebaseConfigured || !FIRESTORE) {
    alCambiar([]);
    return () => {};
  }

  return onSnapshot(
    collection(FIRESTORE, COLECCION_ACTUALIZACIONES_DESTACAMENTOS),
    (snap) => {
      const filas = snap.docs
        .map((documento) => {
          const datos = documento.data() || {};
          return {
            ...datos,
            id: documento.id,
            estado: datos.estado || ESTADOS_ACTUALIZACION.pendiente,
            fechaEnvio: aFecha(datos.creadoEn ?? datos.fechaEnvio),
          };
        })
        .sort((a, b) => (b.fechaEnvio?.getTime() ?? 0) - (a.fechaEnvio?.getTime() ?? 0));
      alCambiar(filas);
    },
    (error) => alFallar?.(error)
  );
}

// ----------------------------------------------------------------------
// CARGAR O DESCARTAR LOS ENVÍOS ELEGIDOS.
//
// Solo se cargan los que se marcan con la casilla: un envío puede traer datos
// a medio saber y el que revisa decide cuáles entran. Pasan por updateDestApi,
// así que quedan en Historial igual que una edición hecha a mano.
//
// Del envío se aplica: nombre, número, dirección, registro en la Oficina
// Nacional, RRITrack, día y hora, y el logo como foto del destacamento.
// La IGLESIA no se toca nunca desde aquí, ni su dirección: UpdateIglesia de la
// API .NET crea otra iglesia cuando no reconoce el correo (y las hay sin él),
// así que la carga duplicaba iglesias. Pastor y coordinador tampoco se tocan.
// Un destacamento NUEVO tampoco se crea
// solo: le falta su iglesia en el padrón y se crea desde Destacamentos.
// ----------------------------------------------------------------------

// Sin sector se conserva el que ya tenía la iglesia: la ficha lee la dirección
// por posiciones (provincia, municipio, sector, calle) y sin él la calle caía
// en el sitio del sector.
const direccionEnTexto = (direccion = {}, anterior = '') =>
  [
    direccion.provincia,
    direccion.municipio,
    direccion.sector || String(anterior).split(',')[2],
    direccion.calle,
  ]
    .map((parte) => String(parte ?? '').trim())
    .filter(Boolean)
    .join(', ')
    // La API .NET rechaza direcciones de más de 100 caracteres.
    .slice(0, 100);

async function leerDestacamentosCrudos() {
  const res = await fetch('/api/dest/');
  const json = await res.json().catch(() => null);
  const lista = json?.data || json?.Data || json;
  if (!res.ok || !Array.isArray(lista))
    throw new Error('No se pudo leer el padrón de destacamentos.');
  return lista;
}

async function marcar(id, estado, usuario) {
  // Es el estado de la bandeja, no un cambio de la organización: lo que se
  // carga ya pasa por proponerCambio en updateDestApi.
  // eslint-disable-next-line no-restricted-syntax
  await updateDoc(doc(FIRESTORE, COLECCION_ACTUALIZACIONES_DESTACAMENTOS, id), {
    estado,
    revisadoEn: serverTimestamp(),
    revisadoPor: {
      id: String(usuario?.idMiembros ?? usuario?.id ?? ''),
      nombre: usuario?.displayName || usuario?.nombre || '',
    },
  });
}

/** Carga en el padrón los envíos elegidos. Devuelve { cargadas, omitidas, fallidas }. */
export async function cargarActualizaciones(filas, usuario) {
  const resultado = { cargadas: 0, omitidas: [], fallidas: [] };
  const [crudos, iglesias] = await Promise.all([leerDestacamentosCrudos(), getChurches()]);

  // Uno detrás de otro: la API .NET es lenta y en paralelo se caía.
  for (const fila of filas) {
    const nombre = fila.nombreDestacamento || fila.destacamento?.nombre || fila.id;
    const crudo = crudos.find((d) => String(d.idDestacamento) === String(fila.destacamento?.id));
    if (fila.esNuevo || !crudo) {
      resultado.omitidas.push(nombre);
      continue;
    }
    try {
      const antes = { ...mapApiDestToUI(crudo), logo: crudo.logo || '' };
      const datos = fila.datos || {};
      const iglesia = iglesias.find((i) => String(i.id) === String(crudo.idIglesia));
      const direccion = direccionEnTexto(datos.direccion, iglesia?.address);
      const despues = {
        ...antes,
        name: datos.nombre || antes.name,
        destNumber: datos.numero || antes.destNumber,
        direccion: direccion || antes.direccion,
        registradoOfnc: datos.registradoOfnc ?? antes.registradoOfnc,
        rritrackActivo: datos.rritrackActivo ?? antes.rritrackActivo,
        destMeetingDays: datos.diaReunion || antes.destMeetingDays,
        destMeetingTimes: datos.horaReunion || antes.destMeetingTimes,
      };
      await updateDestApi(despues, { usuario, antes });
      if (fila.logo?.ruta) {
        const urlFoto =
          fila.logo.url || (await getDownloadURL(ref(FIREBASE_STORAGE, fila.logo.ruta)));
        await aplicarFotoDestacamento({
          idDestacamento: crudo.idDestacamento,
          rutaArchivo: fila.logo.ruta,
          urlFoto,
          subidoPor: usuario?.uid || usuario?.id || '',
        });
      }
      await marcar(fila.id, ESTADOS_ACTUALIZACION.cargada, usuario);
      resultado.cargadas += 1;
    } catch (error) {
      console.error('[actualizaciones de destacamentos] no se pudo cargar', fila.id, error);
      resultado.fallidas.push(nombre);
    }
  }
  return resultado;
}

/** Deja los envíos elegidos como descartados (no se borran: quedan de constancia). */
export async function descartarActualizaciones(filas, usuario) {
  await Promise.all(
    filas.map((fila) => marcar(fila.id, ESTADOS_ACTUALIZACION.descartada, usuario))
  );
}
