'use client';

// ----------------------------------------------------------------------
// EL AVISO DE CAMBIOS SIN GUARDAR SE RETIRO.
//
// Aqui vivia un guardia global que, al salir de un formulario con cambios sin
// guardar, lo advertia con un `confirm` del navegador. Ya no se muestra: se
// pidio quitarlo.
//
// El modulo se conserva —con las mismas firmas— porque de el cuelgan el `Form`
// (prop `protegerSalida`) y el formulario del calendario. Hoy no hacen nada, y
// asi el dia que se quiera volver a poner hay un solo sitio donde hacerlo, en
// vez de tener que recablear las pantallas.
// ----------------------------------------------------------------------

export function useUnsavedChangesGuard() { }

// Siempre se puede descartar: nadie pregunta ya.
export const puedeDescartarCambios = () => true;
