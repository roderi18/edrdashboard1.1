// Mensaje del aviso al sacar un premio de "Completado" en el Sistema de Ascenso.
//
// El aviso lo ven TODOS los cargos, pero dice cosas distintas:
// - Coordinador de Destacamento y su Asistente: confirman y el cambio se aplica
//   en el acto (no tienen a quien pedirle aprobacion).
// - Resto de cargos del destacamento: el cambio queda pendiente de aprobacion.
//
// La frase del documento anexo solo aparece cuando de verdad hay uno cargado:
// sin archivo no hay nada que eliminar y el aviso confundia.

const BASE = '¿Estás seguro de que deseas cambiar un registro que ya está Completado?';

export function buildStatusChangeMessage({ needsApproval = true, hasCertificate = false } = {}) {
  if (needsApproval) {
    return hasCertificate
      ? `${BASE} El certificado cargado se eliminará únicamente cuando la solicitud sea aprobada, y después será necesario volver a cargarlo. El estado no cambiará hasta recibir esa aprobación.`
      : `${BASE} El estado no cambiará hasta recibir la aprobación.`;
  }

  // "Volver a cargarlo": quitar el completado borra el certificado y no se
  // recupera; antes solo decía "se eliminará" y se leía como algo reversible.
  return hasCertificate
    ? `${BASE} El certificado cargado se eliminará y será necesario volver a cargarlo.`
    : BASE;
}
