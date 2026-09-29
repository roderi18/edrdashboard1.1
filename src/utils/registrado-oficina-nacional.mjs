// ----------------------------------------------------------------------
// "REGISTRADO EN OFICINA NACIONAL" SIGUE AL NÚMERO DEL DESTACAMENTO.
// El número lo da la Oficina Nacional al registrar un destacamento, así que
// tenerlo ES estar registrado. Antes había destacamentos con número y el
// interruptor apagado (quedó guardado en false en la API .NET), y la ficha se
// contradecía: "Registrado oficialmente con número de Destacamento" apagado
// junto al número. Con número: siempre encendido. Sin número: lo guardado, y
// sin nada guardado, encendido, como hasta ahora.
// ----------------------------------------------------------------------

export const tieneNumeroDeDestacamento = (numero) => String(numero ?? '').trim() !== '';

export const registradoEnOficinaNacional = (numero, guardado) =>
  tieneNumeroDeDestacamento(numero) ? true : (guardado ?? true);
