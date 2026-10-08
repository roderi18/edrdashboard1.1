import { FieldValue } from 'firebase-admin/firestore';

import { db } from './firebase.mjs';

// ----------------------------------------------------------------------
// AVISOS A LA CAMPANA DEL DASHBOARD (colección `notificaciones`), con la misma
// forma que escribe el dashboard (ver su `src/server/salud-sistema/avisos.mjs`):
// a nombre de "Sistema", para los Administradores Globales y la Oficina
// Nacional de hoy, por rol principal o entre sus cargos (`rolesQueEjerce`).
// ----------------------------------------------------------------------

const ROLES_DESTINO = ['administrador_global', 'oficina_nacional'];
// Los pagos avisan también al Administrador de Tienda (cuadra los cobros).
const ROLES_PAGOS = [...ROLES_DESTINO, 'administrador_tienda'];
const SISTEMA = { idMiembros: 20003, nombre: 'Sistema' };

async function uidsDestinatarios(rolesDestino = ROLES_DESTINO) {
  const roles = db().collection('usuarios_roles');
  const [porRol, porCargos] = await Promise.all([
    roles.where('rolId', 'in', rolesDestino).get(),
    roles.where('rolesQueEjerce', 'array-contains-any', rolesDestino).get(),
  ]);
  const uids = new Set();
  [...porRol.docs, ...porCargos.docs].forEach((d) => {
    const datos = d.data() || {};
    if (datos.activo === false) return;
    const uid = String(datos.uid || (d.id.length > 20 ? d.id : '')).trim();
    if (uid) uids.add(uid);
  });
  return [...uids];
}

const limpiar = (v, max = 300) =>
  String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
const sinHtml = (v) => limpiar(v, 160).replace(/[<>&"]/g, '');

export async function notificarBloqueoAlDashboard(aviso) {
  const idsDestinatarios = await uidsDestinatarios();
  if (!idsDestinatarios.length) return false;
  const d = aviso.destacamento;
  const ahora = new Date().toISOString();
  const nombre = `#${d.numero} ${d.nombre}`.trim();
  await db()
    .collection('notificaciones')
    .doc(`membresia-aviso-${aviso.id}`)
    .set({
      id: `membresia-aviso-${aviso.id}`,
      tipoNotificacion: 'membresia_onerrd_aviso',
      modulo: 'certificados',
      titulo: `Membresía 2027: el destacamento ${nombre} no puede pagar`,
      tituloHtml: `<p>Membresía 2027: <strong>${sinHtml(nombre)}</strong> no puede pagar</p>`,
      mensaje: limpiar(
        `${aviso.motivo} Avisa ${aviso.nombre} (${aviso.correo}${aviso.telefono ? `, ${aviso.telefono}` : ''}).${aviso.comentario ? ` «${aviso.comentario}»` : ''}`,
        900
      ),
      mensajeVisual: limpiar(`${aviso.motivo} Avisa ${aviso.nombre}.`),
      rolDestinatario: 'admin',
      idsDestinatarios,
      prioridad: 'importante',
      estado: 'no_leida',
      creadoPorUid: null,
      fechaCreacion: ahora,
      fechaEnvio: ahora,
      actorId: String(SISTEMA.idMiembros),
      actorTipo: 'sistema',
      actorNombre: SISTEMA.nombre,
      actorFotoURL: null,
      entidadTipo: 'destacamento',
      entidadId: String(d.id),
      ruta: '/dashboard/certificates?tab=onerrd',
      imagenTipo: 'icono',
      imagenURL: null,
      miniaturaURL: null,
      tipoAccion: 'ver',
      etiquetaAccion: 'Ver membresía',
      leidaPor: [],
      metadatos: {
        motivo: aviso.motivo,
        contactoNombre: aviso.nombre,
        contactoCorreo: aviso.correo,
        contactoTelefono: aviso.telefono || '',
        comentario: aviso.comentario || '',
      },
      creadoEnServidor: FieldValue.serverTimestamp(),
      actualizadoEnServidor: FieldValue.serverTimestamp(),
    });
  return true;
}

const formatoRd = (n) => `RD$${Number(n || 0).toLocaleString('en-US')}`;

/**
 * "Entró un pago": transferencia enviada (queda en revisión) o PayPal cobrado.
 * Un aviso por pago (id con la referencia de la solicitud): si PayPal avisa dos
 * veces (retorno y webhook), no se repite. Nunca rompe el pago si falla.
 */
export async function notificarPagoAlDashboard(id, membresia) {
  try {
    const idsDestinatarios = await uidsDestinatarios(ROLES_PAGOS);
    if (!idsDestinatarios.length) return false;
    const d = membresia.destacamento || {};
    const nombre = `#${d.numero} ${d.nombre || ''}`.trim();
    const paypal = membresia.tipoPago === 'paypal';
    const medio = paypal
      ? `PayPal (US$${membresia.paypal?.montoUsd ?? '—'})`
      : 'transferencia bancaria';
    const estado =
      {
        confirmada: `confirmado, código ${membresia.codigo}`,
        pendiente_revision: 'en revisión por datos corregidos',
        pendiente_transferencia: 'comprobante por validar',
      }[membresia.estado] || membresia.estado;
    const ahora = new Date().toISOString();
    const docId = `membresia-pago-${membresia.referencia || id}`;
    await db()
      .collection('notificaciones')
      .doc(docId)
      .create({
        id: docId,
        tipoNotificacion: 'membresia_onerrd_pago',
        modulo: 'certificados',
        titulo: `Membresía 2027: pago de ${nombre}, ${formatoRd(membresia.montoRd)}`,
        tituloHtml: `<p>Membresía 2027: pago de <strong>${sinHtml(nombre)}</strong>, ${formatoRd(membresia.montoRd)}</p>`,
        mensaje: limpiar(
          `${formatoRd(membresia.montoRd)} por ${medio}, plan ${membresia.plan?.nombre || ''}: ${estado}.`,
          600
        ),
        mensajeVisual: limpiar(`${formatoRd(membresia.montoRd)} por ${medio}: ${estado}.`),
        rolDestinatario: 'admin',
        idsDestinatarios,
        prioridad: membresia.estado === 'confirmada' ? 'normal' : 'importante',
        estado: 'no_leida',
        creadoPorUid: null,
        fechaCreacion: ahora,
        fechaEnvio: ahora,
        actorId: String(SISTEMA.idMiembros),
        actorTipo: 'sistema',
        actorNombre: SISTEMA.nombre,
        actorFotoURL: null,
        entidadTipo: 'destacamento',
        entidadId: String(id),
        ruta: '/dashboard/certificates?tab=onerrd',
        imagenTipo: 'icono',
        imagenURL: null,
        miniaturaURL: null,
        tipoAccion: 'ver',
        etiquetaAccion: 'Ver pagos',
        leidaPor: [],
        metadatos: {
          tipoPago: membresia.tipoPago,
          montoRd: membresia.montoRd,
          estadoMembresia: membresia.estado,
          plan: membresia.plan?.id || '',
        },
        creadoEnServidor: FieldValue.serverTimestamp(),
        actualizadoEnServidor: FieldValue.serverTimestamp(),
      });
    return true;
  } catch (error) {
    // Ya avisado (ALREADY_EXISTS) o la campana no responde: el pago sigue.
    if (error?.code !== 6 && !/already exists/i.test(String(error?.message))) {
      console.error('[aviso de pago]', error);
    }
    return false;
  }
}
