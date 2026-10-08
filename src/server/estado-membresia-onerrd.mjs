import { FieldValue } from 'firebase-admin/firestore';

import { COLECCION_MEMBRESIAS } from './membresias-onerrd.mjs';
import { COLECCION_MEMBRESIA } from '../utils/membresia-onerrd.mjs';

// ----------------------------------------------------------------------
// CAMBIAR EL ESTADO DE UNA MEMBRESÍA 2027 desde "Membresías 2027 · pagos".
//
// Una transferencia se quedaba "En revisión" para siempre: nadie podía
// aprobarla, así que nunca tenía código ONERRD 2027 ni se podían emitir su
// certificado y su factura. Ahora la Oficina Nacional:
// · confirma (queda pagada y, si no lo tenía, recibe el siguiente código del
//   mismo contador que usa la landing al confirmar PayPal);
// · rechaza con un motivo (el destacamento puede volver a pagar);
// · o la devuelve a revisión, si se confirmó o rechazó por error (el código ya
//   dado se conserva: no se renumera un identificador emitido).
// Cada cambio queda en `eventos` de la membresía y en Historial.
// ----------------------------------------------------------------------

export const ACCIONES_ESTADO_MEMBRESIA = {
  confirmar: {
    a: 'confirmada',
    desde: ['pendiente_transferencia', 'pendiente_revision', 'rechazada'],
  },
  rechazar: { a: 'rechazada', desde: ['pendiente_transferencia', 'pendiente_revision'] },
  revision: { a: null, desde: ['confirmada', 'rechazada'] },
};

// De vuelta a revisión: la transferencia vuelve a "En revisión"; la de PayPal
// (ya cobrada) a "Pagado · revisar datos".
const estadoDeRevision = (m) =>
  m.tipoPago === 'paypal' ? 'pendiente_revision' : 'pendiente_transferencia';

export async function cambiarEstadoMembresia(db, id, { accion, motivo = '', actor }) {
  const regla = ACCIONES_ESTADO_MEMBRESIA[accion];
  if (!regla) throw new Error('Acción desconocida.');
  if (accion === 'rechazar' && String(motivo).trim().length < 3) {
    throw new Error('Escribe el motivo del rechazo.');
  }
  const referencia = db.collection(COLECCION_MEMBRESIAS).doc(String(id));
  const contador = db.collection(COLECCION_MEMBRESIA).doc('contador');

  return db.runTransaction(async (tx) => {
    const [instantanea, numeracion] = await Promise.all([tx.get(referencia), tx.get(contador)]);
    const m = instantanea.data();
    if (!m) throw new Error('La membresía no existe.');
    if (!regla.desde.includes(m.estado)) {
      throw new Error('La membresía ya cambió de estado. Recarga la lista.');
    }
    const a = regla.a || estadoDeRevision(m);
    const cambios = { estado: a, actualizadoEn: FieldValue.serverTimestamp() };

    if (a === 'confirmada') {
      if (!m.codigo) {
        const siguiente = Number(numeracion.data()?.ultimo || 0) + 1;
        if (!Number.isSafeInteger(siguiente) || siguiente > 9999) {
          throw new Error('El consecutivo anual está agotado.');
        }
        cambios.codigo = `ONERRD 2027-${String(siguiente).padStart(4, '0')}`;
        tx.set(
          contador,
          { ultimo: siguiente, actualizadoEn: FieldValue.serverTimestamp() },
          { merge: true }
        );
      }
      cambios.confirmadoEn = FieldValue.serverTimestamp();
      cambios.motivoRechazo = FieldValue.delete();
      cambios.pagoConfirmado = {
        ...(m.pagoConfirmado || {}),
        proveedor: m.tipoPago || 'transferencia',
        validadaManual: true,
        oficialId: actor.uid,
        oficialNombre: actor.nombre,
      };
    } else if (a === 'rechazada') {
      cambios.motivoRechazo = String(motivo).trim().slice(0, 500);
    } else {
      cambios.motivoRechazo = FieldValue.delete();
    }

    tx.update(referencia, cambios);
    tx.create(referencia.collection('eventos').doc(), {
      de: m.estado,
      a,
      actor: actor.uid,
      actorNombre: actor.nombre,
      fecha: FieldValue.serverTimestamp(),
      ...(a === 'rechazada' ? { motivo: cambios.motivoRechazo } : {}),
    });
    return { antes: m.estado, despues: a, codigo: cambios.codigo || m.codigo || '' };
  });
}
