// CÓMO SE ENTREGA UN PUSH CON LA APLICACIÓN CERRADA.
//
// Se enviaban con la urgencia por defecto ("normal") y una hora de vida. Con el
// teléfono en reposo, Android (Doze) y el servicio push retienen los mensajes
// "normal" hasta que el aparato se despierta: en la práctica, el aviso llegaba
// al abrir la aplicación. Y si la espera pasaba de una hora, se perdía.
//
// "high" pide entrega inmediata aunque el teléfono duerma; 24 horas de vida
// cubren un teléfono apagado o sin señal durante la noche.
export const OPCIONES_ENVIO_PUSH = Object.freeze({
  TTL: 24 * 60 * 60,
  urgency: 'high',
});
