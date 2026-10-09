import { FieldValue } from 'firebase-admin/firestore';

import { db } from './firebase.mjs';
import { hayCorrecciones } from './correcciones.mjs';
import { notificarPagoAlDashboard } from './notificar-dashboard.mjs';
import { avisarRevision, registrarCorreo, avisarConfirmacion } from './correo.mjs';

export const membresias = () => db().collection('membresiasOnerrd2027');

// `esperado`: el estado (o los estados) desde el que se puede confirmar.
export async function confirmarMembresia(id, esperado, pago = {}) {
  const esperados = [].concat(esperado);
  const memberRef = membresias().doc(String(id));
  const counterRef = db().collection('configuracionMembresia2027').doc('contador');
  const confirmada = await db().runTransaction(async (tx) => {
    const [memberSnap, counterSnap] = await Promise.all([tx.get(memberRef), tx.get(counterRef)]);
    const member = memberSnap.data();
    if (!member || !esperados.includes(member.estado))
      throw new Error('La solicitud ya cambió de estado.');
    // CON DATOS CORREGIDOS ("Corregir datos"), un pago que no valida a mano la
    // Oficina Nacional (PayPal) no activa la membresía: queda pagado y en
    // revisión, sin código, hasta que se confirmen los cambios.
    if (hayCorrecciones(member.correcciones) && !pago.validadaManual) {
      tx.update(memberRef, {
        estado: 'pendiente_revision',
        pagoConfirmado: pago,
        pagadoEn: FieldValue.serverTimestamp(),
        actualizadoEn: FieldValue.serverTimestamp(),
      });
      tx.create(memberRef.collection('eventos').doc(), {
        de: member.estado,
        a: 'pendiente_revision',
        actor: pago.proveedor === 'paypal' ? 'paypal' : 'sistema',
        fecha: FieldValue.serverTimestamp(),
        referenciaPago: pago.captureId || '',
        motivo: 'Datos del destacamento corregidos por el solicitante.',
      });
      return { ...member, estado: 'pendiente_revision' };
    }
    if (member.codigo) throw new Error('La membresía ya tiene un código asignado.');
    const next = Number(counterSnap.data()?.ultimo || 0) + 1;
    if (!Number.isSafeInteger(next) || next > 9999)
      throw new Error('El consecutivo anual está agotado.');
    const codigo = `ONERRD 2027-${String(next).padStart(4, '0')}`;
    tx.set(
      counterRef,
      { ultimo: next, actualizadoEn: FieldValue.serverTimestamp() },
      { merge: true }
    );
    tx.update(memberRef, {
      estado: 'confirmada',
      codigo,
      pagoConfirmado: pago,
      confirmadoEn: FieldValue.serverTimestamp(),
      actualizadoEn: FieldValue.serverTimestamp(),
    });
    tx.create(memberRef.collection('eventos').doc(), {
      de: member.estado,
      a: 'confirmada',
      actor: pago.proveedor === 'paypal' ? 'paypal' : pago.oficialId || 'oficina-nacional',
      fecha: FieldValue.serverTimestamp(),
      referenciaPago: pago.captureId || member.deposito?.referencia || '',
    });
    return { ...member, estado: 'confirmada', codigo };
  });
  // PayPal ya cobró: la campana del dashboard se entera del pago.
  if (confirmada.tipoPago === 'paypal') await notificarPagoAlDashboard(id, confirmada);
  if (confirmada.estado === 'pendiente_revision') {
    await registrarCorreo(id, 'revision', await avisarRevision(confirmada));
    return confirmada;
  }
  // UN PAGO CON PAYPAL no espera a la Oficina Nacional: el servidor del dashboard
  // genera el certificado y la factura y los envía él (con los PDF adjuntos), así
  // que aquí no sale el aviso de «le enviará» (`solicitarEmision`, al abrir el paso 4).
  if (confirmada.tipoPago === 'paypal') return confirmada;
  const correo = await avisarConfirmacion(confirmada).catch((error) => ({
    estado: 'fallido',
    error: error.message,
  }));
  await registrarCorreo(id, 'confirmacion', correo);
  return confirmada;
}
