import { ref, getDownloadURL } from 'firebase/storage';
import {
  doc,
  setDoc,
  updateDoc,
  increment,
  collection,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';

import {
  RESERVA_MS,
  DOC_CARGA_AUTOMATICA,
  COLECCION_CONFIG_ACTUALIZACIONES,
} from 'src/utils/carga-automatica-actualizaciones.mjs';

import { FIRESTORE, FIREBASE_STORAGE, isFirebaseConfigured } from 'src/lib/firebase';

import { AMBITOS_CAMBIO, proponerCambio } from './solicitudes-cambio-service';
import { notificarCargaAutomatica } from './notificar-oficina-nacional-service';
import { updateDestApi, mapApiDestToUI, aplicarFotoDestacamento } from './dest-service';
import { getChurches, crearIglesiaConTexto, actualizarIglesiaConTexto } from './church-service';

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
    // Las cuatro posiciones siempre, aunque alguna vaya vacía: la ficha lee por
    // posición y, sin el hueco del sector, la calle caía en su sitio.
    .join(', ')
    .replace(/^(, )+$/, '')
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

// "+18097510322" → "8097510322": el padrón guarda los teléfonos sin el +1.
const telefonoDelPadron = (valor) => {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  return digitos.length === 11 && digitos.startsWith('1') ? digitos.slice(1) : digitos;
};

/**
 * LA IGLESIA DEL ENVÍO: nombre, pastor, su teléfono y la dirección (con sector y
 * calle). La ficha del destacamento lee la dirección de la iglesia, así que sin
 * esto lo que el directivo corrigió no se veía en la aplicación.
 *
 * Primero se intenta actualizar la iglesia (con SU correo: UpdateIglesia crea
 * otra si no lo reconoce). Si no tiene correo o la API falla —UpdateIglesia
 * responde 500 a todo desde el 28/09/2026—, se CREA una iglesia con los datos
 * buenos y el destacamento pasa a apuntar a ella. La anterior queda sin
 * destacamento; no se borra.
 *
 * Devuelve { estado, idIglesia }: el id con el que debe quedar el destacamento.
 */
async function cargarIglesia({ fila, iglesia, direccion, usuario }) {
  const datos = fila.datos || {};
  const antes = {
    nombre: iglesia?.name || '',
    pastor: iglesia?.pastor || '',
    telefono: iglesia?.telefono || '',
    direccion: iglesia?.address || '',
  };
  const despues = {
    nombre: String(datos.iglesia || '').trim() || antes.nombre,
    pastor: String(datos.pastor?.nombre || '').trim() || antes.pastor,
    telefono: telefonoDelPadron(datos.pastor?.telefono) || antes.telefono,
    direccion: direccion || antes.direccion,
  };
  const etiquetas = {
    nombre: 'Iglesia',
    pastor: 'Pastor',
    telefono: 'Teléfono del pastor',
    direccion: 'Dirección',
  };
  const cambios = Object.keys(etiquetas)
    .filter((campo) => String(antes[campo] ?? '') !== String(despues[campo] ?? ''))
    .map((campo) => ({
      campo,
      etiqueta: etiquetas[campo],
      antes: antes[campo] || null,
      despues: despues[campo] || null,
    }));
  if (iglesia && !cambios.length) return { estado: 'sin_cambios', idIglesia: String(iglesia.id) };

  let resultado = { estado: 'actualizada', idIglesia: String(iglesia?.id || '') };
  await proponerCambio({
    ambito: AMBITOS_CAMBIO.destacamento,
    entidad: {
      tipo: 'iglesia',
      id: String(iglesia?.id || ''),
      nombre: despues.nombre,
      ruta: '/dashboard/level/dest',
    },
    cambios,
    usuario,
    aplicarDirecto: true,
    descripcion: `Iglesia ${despues.nombre} actualizada desde la página de actualización.`,
    aplicar: async () => {
      if (iglesia && String(iglesia.correo || '').trim()) {
        try {
          await actualizarIglesiaConTexto({
            id: iglesia.id,
            ...despues,
            correo: iglesia.correo,
            idSeccion: iglesia.idSeccion,
          });
          return;
        } catch (error) {
          console.warn('[actualizaciones de destacamentos] UpdateIglesia falló; se crea', error);
        }
      }
      const idNueva = await crearIglesiaConTexto({
        ...despues,
        idSeccion: iglesia?.idSeccion || fila.seccion?.id,
      });
      resultado = { estado: 'creada', idIglesia: idNueva };
    },
  });
  return resultado;
}

/** Carga en el padrón los envíos elegidos. Devuelve { cargadas, omitidas, fallidas, iglesiasCreadas, iglesiasFallidas }. */
export async function cargarActualizaciones(filas, usuario, { automatica = false } = {}) {
  const resultado = { cargadas: 0, omitidas: [], fallidas: [], iglesiasCreadas: [], iglesiasFallidas: [] };
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
      // La automática avisa con su propio mensaje (ver `cargarAutomaticamente`).
      // La iglesia ANTES que el destacamento: si hay que crearla, el destacamento
      // se guarda ya apuntando a la nueva. Si falla, el destacamento se carga igual.
      try {
        const { estado, idIglesia } = await cargarIglesia({ fila, iglesia, direccion, usuario });
        if (idIglesia) despues.churchId = idIglesia;
        if (estado === 'creada') resultado.iglesiasCreadas.push(nombre);
      } catch (errorIglesia) {
        console.error('[actualizaciones de destacamentos] no se cargó la iglesia', fila.id, errorIglesia);
        resultado.iglesiasFallidas.push(nombre);
      }
      await updateDestApi(despues, { usuario, antes, sinAviso: automatica });

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

// ----------------------------------------------------------------------
// CARGA AUTOMÁTICA (ver src/utils/carga-automatica-actualizaciones.mjs).
// ----------------------------------------------------------------------

const refConfig = () => doc(FIRESTORE, COLECCION_CONFIG_ACTUALIZACIONES, DOC_CARGA_AUTOMATICA);

/** Escucha el interruptor: { activa, desde, activadaPor }. */
export function escucharCargaAutomatica(alCambiar) {
  if (!isFirebaseConfigured || !FIRESTORE) {
    alCambiar({ activa: false });
    return () => {};
  }
  return onSnapshot(
    refConfig(),
    (snap) => alCambiar(snap.exists() ? snap.data() : { activa: false }),
    () => alCambiar({ activa: false })
  );
}

/**
 * Enciende o apaga la carga automática. `desde` marca la hora de encendido: solo
 * se cargan solos los envíos que lleguen después.
 */
export async function cambiarCargaAutomatica(activa, usuario) {
  const quien = {
    id: String(usuario?.idMiembros ?? usuario?.id ?? ''),
    nombre: usuario?.displayName || usuario?.nombre || '',
  };
  // Es un ajuste de la bandeja, como su estado: lo que se carga luego sí pasa
  // por proponerCambio en updateDestApi.
  // eslint-disable-next-line no-restricted-syntax
  await setDoc(
    refConfig(),
    activa
      ? { activa: true, desde: Date.now(), activadaPor: quien, cambiadaEn: serverTimestamp() }
      : { activa: false, desactivadaPor: quien, cambiadaEn: serverTimestamp() },
    { merge: true }
  );
}

/** Reserva un envío para esta sesión. false si otra ya lo tomó o dejó de estar pendiente. */
async function reservar(id, uid) {
  const referencia = doc(FIRESTORE, COLECCION_ACTUALIZACIONES_DESTACAMENTOS, id);
  return runTransaction(FIRESTORE, async (transaccion) => {
    const actual = (await transaccion.get(referencia)).data() || {};
    const hasta = Number(actual.cargaAutomatica?.reservadoHasta) || 0;
    if ((actual.estado || 'pendiente') !== 'pendiente' || hasta > Date.now()) return false;
    transaccion.update(referencia, {
      'cargaAutomatica.reservadoHasta': Date.now() + RESERVA_MS,
      'cargaAutomatica.reservadoPor': uid,
    });
    return true;
  });
}

/**
 * Carga un envío solo y avisa. Nunca lanza: un fallo cuenta un intento y libera
 * la reserva para reintentarlo (hasta INTENTOS_MAXIMOS; luego, a mano).
 */
export async function cargarAutomaticamente(fila, usuario) {
  const uid = String(usuario?.uid ?? usuario?.id ?? '');
  const referencia = doc(FIRESTORE, COLECCION_ACTUALIZACIONES_DESTACAMENTOS, fila.id);
  try {
    if (!(await reservar(fila.id, uid))) return false;
    const { cargadas } = await cargarActualizaciones([fila], usuario, { automatica: true });
    if (!cargadas) throw new Error('La carga no se completó.');
    // eslint-disable-next-line no-restricted-syntax
    await updateDoc(referencia, {
      'cargaAutomatica.cargadaEn': serverTimestamp(),
      'cargaAutomatica.reservadoHasta': 0,
    });
    notificarCargaAutomatica({
      destacamento: {
        id: fila.destacamento?.id,
        nombre: [fila.nombreDestacamento || fila.destacamento?.nombre, fila.numeroDestacamento]
          .filter(Boolean)
          .join(' '),
      },
      enviadoPor: fila.enviadoPor?.nombre || '',
      usuario,
    }).catch((error) => console.warn('[carga automática] no se pudo avisar', error));
    return true;
  } catch (error) {
    console.error('[carga automática] no se pudo cargar', fila.id, error);
    // eslint-disable-next-line no-restricted-syntax
    await updateDoc(referencia, {
      'cargaAutomatica.intentos': increment(1),
      'cargaAutomatica.reservadoHasta': 0,
      'cargaAutomatica.ultimoError': String(error?.message || error).slice(0, 200),
    }).catch(() => {});
    return false;
  }
}
