import 'server-only';

import { getAdminDb } from 'src/server/firebase-admin';
import {
  buscarMiembroPorId,
  nombreCortoDeMiembro,
  buscarMiembroPorNumero,
} from 'src/server/miembros-directorio';

// ----------------------------------------------------------------------
// "Solicitar recuperacion a mi Coordinador", del lado del servidor.
//
// Lo hacia el navegador: desde la pantalla de recuperacion —sin sesion— leia el
// organigrama, `usuarios_roles` y `users` para averiguar a quien avisar, y
// escribia la notificacion. Eso obligaba a que esas colecciones estuvieran
// abiertas a cualquiera, con sesion o sin ella.
//
// Ahora la pantalla solo dice "soy el numero 10011"; el resto pasa aqui, y de
// vuelta van los NOMBRES CORTOS de los coordinadores —lo justo para saber a
// quien acudir— y nada mas.
// ----------------------------------------------------------------------

const COLECCION_ORGANIGRAMA = 'organigrama_directiva_destacamentos';
const COLECCION_NOTIFICACIONES = 'notificaciones';
const COLECCION_PREFERENCIAS = 'preferencias_notificaciones';
const TIPO = 'recuperacion_clave_miembro';
const MODULO = 'miembros';

const CARGOS_COORDINACION = ['coordinador_destacamento', 'coordinador_asistente_destacamento'];

/** Los coordinadores (titular y asistente) del destacamento. */
const coordinadoresDelDestacamento = async (idDestacamento) => {
  const encontrados = await getAdminDb()
    .collection(COLECCION_ORGANIGRAMA)
    .where('idDestacamento', '==', Number(idDestacamento))
    .get()
    .catch((error) => {
      console.error('[recuperacion] no se pudo leer el organigrama', error);

      return null;
    });

  return (encontrados?.docs ?? [])
    .map((documento) => ({ id: documento.id, ...documento.data() }))
    .filter(
      (asignacion) => asignacion.activo === true && CARGOS_COORDINACION.includes(asignacion.cargo)
    );
};

/**
 * Con que ids se le puede escribir a ese miembro.
 *
 * El panel de notificaciones filtra por el uid de la cuenta, que no es su id de
 * miembro: hay que resolver los dos, y el documento puede estar guardado con
 * cualquiera de ellos.
 */
const destinatariosDe = async (idMiembros) => {
  const db = getAdminDb();
  const ids = new Set();
  const anotar = (documento) => {
    const datos = documento.data() || {};

    [datos.uid, datos.idUsuario, documento.id, datos.codigoMiembro]
      .filter(Boolean)
      .forEach((valor) => ids.add(String(valor)));
  };

  await Promise.all([
    ...['usuarios_roles', 'users'].map(async (coleccion) => {
      const encontrados = await db
        .collection(coleccion)
        .where('idMiembros', '==', Number(idMiembros))
        .get()
        .catch(() => null);

      encontrados?.docs?.forEach(anotar);
    }),
    (async () => {
      const directo = await db
        .collection('usuarios_roles')
        .doc(String(idMiembros))
        .get()
        .catch(() => null);

      if (directo?.exists) anotar(directo);
    })(),
  ]);

  return [...ids];
};

/** Quien apagó este aviso no lo recibe, igual que en el resto de la aplicacion. */
const filtrarPorPreferencias = async (ids) => {
  const db = getAdminDb();
  const decisiones = await Promise.all(
    ids.map(async (id) => {
      const documento = await db
        .collection(COLECCION_PREFERENCIAS)
        .doc(String(id))
        .get()
        .catch(() => null);
      const datos = documento?.exists ? documento.data() : null;

      if (!datos) return id;
      if (datos.tiposNotificacion?.[TIPO] === false) return null;
      if (datos.modulos?.[MODULO] === false) return null;

      return id;
    })
  );

  return decisiones.filter(Boolean);
};

/**
 * Avisa a los coordinadores de que un miembro no puede entrar.
 *
 * Devuelve a quien se le pidio ayuda (nombre y cargo) para poder decirselo, y
 * cuantos lo recibieron de verdad.
 */
export const pedirAyudaAlCoordinador = async ({ numeroUsuario }) => {
  const miembro = await buscarMiembroPorNumero(numeroUsuario);

  if (!miembro) return { motivo: 'sin_miembro', enviadas: 0, coordinadores: [] };

  const idDestacamento = Number(miembro?.idDestacamento ?? miembro?.destId) || null;

  if (!idDestacamento) return { motivo: 'sin_destacamento', enviadas: 0, coordinadores: [] };

  const asignaciones = await coordinadoresDelDestacamento(idDestacamento);

  if (!asignaciones.length) return { motivo: 'sin_coordinador', enviadas: 0, coordinadores: [] };

  // El nombre de cada coordinador sale de su propia ficha; la asignacion trae una
  // copia que puede estar vieja y se usa solo de reserva.
  const fichas = await Promise.all(
    asignaciones.map((asignacion) => buscarMiembroPorId(asignacion.idMiembros).catch(() => null))
  );
  const coordinadores = asignaciones.map((asignacion, indice) => ({
    nombre:
      nombreCortoDeMiembro(fichas[indice]) ||
      nombreCortoDeMiembro(asignacion) ||
      'tu coordinador',
    cargo: asignacion.cargo,
  }));

  const listas = await Promise.all(
    asignaciones.map((asignacion) => destinatariosDe(asignacion.idMiembros))
  );
  const alcanzados = listas.filter((ids) => ids.length).length;
  const ids = await filtrarPorPreferencias([...new Set(listas.flat())]);

  if (!ids.length) return { motivo: 'sin_cuenta', enviadas: 0, coordinadores };

  const nombreMiembro = nombreCortoDeMiembro(miembro) || 'un miembro';
  const codigoMiembro = String(miembro?.codigoMiembro || miembro?.memberId || '');
  const idMiembros = String(miembro?.idMiembros ?? miembro?.id ?? '');
  const ahora = new Date().toISOString();
  // Un solo documento con los dos coordinadores dentro: creando uno por cabeza,
  // los dos caian en el mismo id —se generan en el mismo milisegundo— y el
  // segundo pisaba al primero, asi que solo llegaba a uno.
  const id = `${TIPO}_${idMiembros || codigoMiembro || Date.now()}_${Date.now()}`;

  await getAdminDb()
    .collection(COLECCION_NOTIFICACIONES)
    .doc(id)
    .set(
      {
        id,
        tipoNotificacion: TIPO,
        modulo: MODULO,
        titulo: 'Recuperación de contraseña',
        mensaje: `${nombreMiembro} (${codigoMiembro || 'sin código'}) no puede entrar y pide ayuda para recuperar su contraseña.`,
        mensajeVisual: `${nombreMiembro} (${codigoMiembro || 'sin código'}) no puede entrar y pide ayuda para recuperar su contraseña.`,
        rolDestinatario: 'admin',
        idsDestinatarios: ids,
        prioridad: 'importante',
        estado: 'no_leida',
        fechaCreacion: ahora,
        fechaEnvio: ahora,
        actorId: 'sistema',
        actorTipo: 'sistema',
        actorNombre: nombreMiembro,
        entidadTipo: 'miembro',
        entidadId: idMiembros,
        ruta: idMiembros ? `/dashboard/level/member/${idMiembros}/edit` : '/dashboard/level/member',
        imagenTipo: 'icono',
        tipoAccion: 'ver',
        etiquetaAccion: 'Ayudar',
        leidaPor: [],
        metadatos: {
          idMiembroSolicitante: idMiembros,
          codigoMiembroSolicitante: codigoMiembro,
          atendida: false,
        },
      },
      { merge: true }
    );

  return { motivo: '', enviadas: alcanzados, coordinadores };
};
