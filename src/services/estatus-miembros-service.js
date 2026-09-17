import { puedeMarcarFallecido } from 'src/utils/estatus-miembro-avisos.mjs';
import { ESTATUS_MIEMBRO, normalizarEstatusMiembro } from 'src/utils/estatus-miembro.mjs';
import {
  AUTOR_SISTEMA,
  explicarEstatus,
  evaluarPorTiempo,
  aplicarPaseDeLista,
  aplicarCambioManual,
  estaPorCaerEnInactivo,
  registroInicialDeEstatus,
  reiniciarPorCambioDeDestacamento,
} from 'src/utils/estatus-por-asistencia.mjs';

import { FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { AMBITOS_CAMBIO, proponerCambio } from 'src/services/solicitudes-cambio-service';
import {
  crearNotificacionEstatusMiembros,
  crearNotificacionProximosAInactivo,
} from 'src/services/notification-service';

import { registrarAuditoriaSilenciosa } from './audit-log-service';
import {
  leerEstatusGuardados,
  escribirEstatusDeMiembro,
  escribirEstatusDeMiembros,
} from './estatus-miembros-apply';

// ----------------------------------------------------------------------
// EL ESTATUS DEL MIEMBRO, MOVIDO POR LA ASISTENCIA.
//
// La regla vive en `src/utils/estatus-por-asistencia.mjs` (probada aparte); aquí
// solo se lee lo guardado, se aplica y se avisa. Dos entradas:
//
//   1. Al guardar un pase de lista (faltas y presencias seguidas).
//   2. Al abrir la lista del destacamento (los 3 meses sin venir, que no los
//      dispara ningún pase de lista).
//
// El cambio automático queda en Historial como "Sistema"; el de a mano pasa por
// `proponerCambio` con el nombre de quien lo hizo y su motivo.
// ----------------------------------------------------------------------

const asegurarFirebase = () => {
  if (!isFirebaseConfigured || !FIRESTORE) {
    throw new Error('Firebase no está configurado.');
  }
};

const hoyEnTexto = () => new Date().toISOString().slice(0, 10);

const idDe = (miembro = {}) =>
  String(miembro.idMiembros ?? miembro.idMiembro ?? miembro.id ?? miembro.memberId ?? '').trim();

const nombreDe = (miembro = {}) =>
  String(
    miembro.nombreMiembro ??
      `${miembro.nombres ?? ''} ${miembro.apellidos ?? ''}`.trim() ??
      miembro.name ??
      ''
  ).trim() || idDe(miembro);

// El registro de un miembro, ya sea el guardado o uno recién estrenado. Un
// miembro sin documento empieza en Reclutamiento: nunca se le ha visto venir.
const registroDe = (guardados, miembro) => {
  const id = idDe(miembro);
  const guardado = guardados.get(id);

  return {
    ...registroInicialDeEstatus({
      idMiembros: id,
      idDestacamento: miembro.idDestacamento ?? miembro.destId ?? '',
      estatus: guardado?.estatus ?? ESTATUS_MIEMBRO.NECESITA_RECLUTAMIENTO,
      desde: guardado?.desde ?? miembro.fechaIngreso ?? '',
    }),
    ...(guardado ?? {}),
  };
};

const describirCambio = (miembro, antes, despues) => ({
  idMiembros: idDe(miembro),
  nombreMiembro: nombreDe(miembro),
  codigoMiembro: miembro.codigoMiembro ?? miembro.memberId ?? '',
  idDestacamento: String(despues.idDestacamento || miembro.idDestacamento || ''),
  estatusAnterior: antes.estatus,
  estatus: despues.estatus,
  motivo: despues.motivo,
});

const registrarEnHistorial = (cambios, destacamento, usuario) => {
  cambios.forEach((cambio) =>
    registrarAuditoriaSilenciosa({
      modulo: 'miembros',
      accion: 'estatus_miembro_cambiado',
      descripcion: `${cambio.nombreMiembro} pasó a "${cambio.estatus}" por la asistencia. ${cambio.motivo}`,
      entidad: {
        tipo: 'miembro',
        id: cambio.idMiembros,
        nombre: cambio.nombreMiembro,
        ruta: `/dashboard/member/${cambio.codigoMiembro || cambio.idMiembros}/edit`,
      },
      antes: { estatusMiembro: cambio.estatusAnterior },
      despues: { estatusMiembro: cambio.estatus, motivo: cambio.motivo },
      // El cambio no lo hizo quien pasó lista: lo hizo la regla.
      realizadoPor: { nombre: 'Sistema', uid: AUTOR_SISTEMA },
      origen: 'asistencia',
      metadatos: {
        idDestacamento: cambio.idDestacamento,
        nombreDestacamento: destacamento?.nombreDestacamento ?? '',
        pasoLista: usuario?.displayName ?? '',
      },
    })
  );
};

// Un aviso para todos los que cambiaron, no uno por miembro: un pase de lista
// puede mover a media docena y serían seis campanas seguidas.
const avisar = async ({ cambios, destacamento, usuario }) => {
  if (!cambios.length) return;

  await crearNotificacionEstatusMiembros({ cambios, destacamento, usuario }).catch((error) =>
    // Si el aviso falla, el estatus ya está guardado: no se deshace por esto.
    console.error('[estatus] no se pudo avisar del cambio', error)
  );
};

// ----------------------------------------------------------------------
// 1. AL GUARDAR UN PASE DE LISTA
// ----------------------------------------------------------------------

export async function evaluarEstatusTrasPaseDeLista({
  fecha,
  destacamento = {},
  miembros = [],
  estados = {},
  esReunion = true,
  usuario = null,
} = {}) {
  asegurarFirebase();

  if (!fecha || !miembros.length) return [];

  const guardados = await leerEstatusGuardados();
  const cambios = [];
  const porGuardar = [];

  miembros.forEach((miembro) => {
    const id = idDe(miembro);

    if (!id) return;

    const antes = registroDe(guardados, miembro);
    const despues = aplicarPaseDeLista({
      registro: antes,
      estado: estados[id] ?? 'ausente',
      fecha,
      esReunion,
    });

    porGuardar.push(despues);

    if (despues.estatus !== antes.estatus) cambios.push(describirCambio(miembro, antes, despues));
  });

  await escribirEstatusDeMiembros(porGuardar);
  registrarEnHistorial(cambios, destacamento, usuario);
  await avisar({ cambios, destacamento, usuario });

  return cambios;
}

// ----------------------------------------------------------------------
// 2. AL ABRIR LA LISTA DEL DESTACAMENTO (los 3 meses)
// ----------------------------------------------------------------------

export async function evaluarEstatusPorTiempo({
  miembros = [],
  destacamento = {},
  usuario = null,
} = {}) {
  asegurarFirebase();

  if (!miembros.length) return { cambios: [], porCaer: [] };

  const hoy = hoyEnTexto();
  const guardados = await leerEstatusGuardados();
  const cambios = [];
  const porGuardar = [];
  const porCaer = [];

  miembros.forEach((miembro) => {
    if (!idDe(miembro)) return;

    const antes = registroDe(guardados, miembro);
    const despues = evaluarPorTiempo({ registro: antes, hoy });

    if (despues.estatus !== antes.estatus) {
      porGuardar.push(despues);
      cambios.push(describirCambio(miembro, antes, despues));
      return;
    }

    if (estaPorCaerEnInactivo({ registro: antes, hoy })) {
      porCaer.push(describirCambio(miembro, antes, antes));
    }
  });

  await escribirEstatusDeMiembros(porGuardar);
  registrarEnHistorial(cambios, destacamento, usuario);
  await avisar({ cambios, destacamento, usuario });

  if (porCaer.length) {
    await crearNotificacionProximosAInactivo({ miembros: porCaer, destacamento, usuario }).catch(
      (error) => console.error('[estatus] no se pudo avisar del aviso previo', error)
    );
  }

  return { cambios, porCaer };
}

// ----------------------------------------------------------------------
// 3. A MANO
// ----------------------------------------------------------------------

export async function guardarEstatusManual({
  miembro = {},
  estatus,
  motivo = '',
  cargos = [],
  usuario = {},
} = {}) {
  asegurarFirebase();

  const destino = normalizarEstatusMiembro(estatus);
  const texto = String(motivo ?? '').trim();

  if (!idDe(miembro)) throw new Error('No se sabe de qué miembro es el estatus.');
  if (!texto) throw new Error('Escribe el motivo del cambio: queda en Historial y en el aviso.');

  // "Fallecido" es el único estatus que la asistencia no revierte: solo el
  // Coordinador de Destacamento, su Asistente y el Administrador Global.
  if (destino === ESTATUS_MIEMBRO.FALLECIDO && !puedeMarcarFallecido(cargos)) {
    throw new Error(
      'Solo el Coordinador de Destacamento, su Asistente y el Administrador Global pueden marcar "Fallecido".'
    );
  }

  const guardados = await leerEstatusGuardados();
  const antes = registroDe(guardados, miembro);
  const despues = aplicarCambioManual({
    registro: antes,
    estatus: destino,
    motivo: texto,
    autor: usuario?.displayName || usuario?.nombre || usuario?.email || 'manual',
    hoy: hoyEnTexto(),
  });

  await proponerCambio({
    ambito: AMBITOS_CAMBIO.estatusMiembro,
    entidad: {
      tipo: 'miembro',
      id: idDe(miembro),
      nombre: nombreDe(miembro),
      ruta: `/dashboard/member/${miembro.codigoMiembro || idDe(miembro)}/edit`,
    },
    cambios: [
      {
        campo: 'estatusMiembro',
        etiqueta: 'Estatus del miembro',
        antes: antes.estatus,
        despues: destino,
      },
      { campo: 'motivo', etiqueta: 'Motivo', antes: antes.motivo || '', despues: texto },
    ],
    usuario,
    descripcion: `${nombreDe(miembro)} pasó a "${destino}": ${texto}`,
    aplicar: () => escribirEstatusDeMiembro(despues),
  });

  const cambio = describirCambio(miembro, antes, despues);

  if (antes.estatus !== destino) {
    await avisar({
      cambios: [cambio],
      destacamento: { idDestacamento: cambio.idDestacamento },
      usuario,
    });
  }

  return despues;
}

// ----------------------------------------------------------------------
// LECTURA
// ----------------------------------------------------------------------

/** Lo guardado de esos miembros, para pintar el chip y su explicación. */
export async function leerEstatusDeMiembros(idsMiembros = []) {
  if (!isFirebaseConfigured || !FIRESTORE || !idsMiembros.length) return {};

  const guardados = await leerEstatusGuardados();

  return Object.fromEntries(
    idsMiembros
      .map((id) => String(id))
      .filter(Boolean)
      .map((id) => {
        const registro = guardados.get(id) ?? registroInicialDeEstatus({ idMiembros: id });

        return [id, { ...registro, explicacion: explicarEstatus(registro) }];
      })
  );
}

/** Al mover a alguien de destacamento, las rachas empiezan de cero. */
export async function reiniciarEstatusPorCambioDeDestacamento({
  miembro = {},
  idDestacamento,
} = {}) {
  asegurarFirebase();

  const guardados = await leerEstatusGuardados();

  return escribirEstatusDeMiembro(
    reiniciarPorCambioDeDestacamento({
      registro: registroDe(guardados, miembro),
      idDestacamento,
    })
  );
}
