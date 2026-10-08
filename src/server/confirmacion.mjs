import { FieldValue } from 'firebase-admin/firestore';

import { db } from './firebase.mjs';
import { avisarConfirmacion } from './correo.mjs';

export const membresias = () => db().collection('membresiasOnerrd2027');

export async function confirmarMembresia(id, esperado, pago = {}) {
  const memberRef = membresias().doc(String(id));
  const counterRef = db().collection('configuracionMembresia2027').doc('contador');
  const confirmada = await db().runTransaction(async (tx) => {
    const [memberSnap, counterSnap] = await Promise.all([tx.get(memberRef), tx.get(counterRef)]);
    const member = memberSnap.data();
    if (!member || member.estado !== esperado) throw new Error('La solicitud ya cambió de estado.');
    if (member.codigo) throw new Error('La membresía ya tiene un código asignado.');
    const next = Number(counterSnap.data()?.ultimo || 0) + 1;
    if (!Number.isSafeInteger(next) || next > 9999) throw new Error('El consecutivo anual está agotado.');
    const codigo = `ONERRD 2027-${String(next).padStart(4, '0')}`;
    tx.set(counterRef, { ultimo: next, actualizadoEn: FieldValue.serverTimestamp() }, { merge: true });
    tx.update(memberRef, {
      estado: 'confirmada', codigo, pagoConfirmado: pago,
      confirmadoEn: FieldValue.serverTimestamp(), actualizadoEn: FieldValue.serverTimestamp(),
    });
    tx.create(memberRef.collection('eventos').doc(), {
      de: esperado, a: 'confirmada', actor: pago.proveedor === 'paypal' ? 'paypal' : pago.oficialId || 'oficina-nacional',
      fecha: FieldValue.serverTimestamp(), referenciaPago: pago.captureId || member.deposito?.referencia || '',
    });
    return { ...member, estado: 'confirmada', codigo };
  });
  await avisarConfirmacion(confirmada).catch((error) => console.error('[correo confirmación]', error));
  return confirmada;
}
