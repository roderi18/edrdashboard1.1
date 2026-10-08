'use client';

import { use, useRef, useState, useEffect, useCallback } from 'react';

import { AuthContext } from 'src/auth/components/context/auth-context';

// ----------------------------------------------------------------------
// BORRADORES DE FORMULARIO.
//
// Lo escrito y no guardado sobrevive a un F5 y a cerrar la aplicacion. Vive en
// `localStorage` y no en Firestore a proposito: un borrador es de UNA persona en
// UN dispositivo, no informacion de la organizacion. Llevarlo al servidor lo
// metia en las reglas, en los respaldos y al alcance de otros, y un campo a
// medio escribir no es un dato que la organizacion deba guardar.
//
// La clave lleva el uid de quien edita: en un equipo compartido, cada quien ve
// SU borrador y solo el suyo. Sin uid no se guarda nada —no se puede decir de
// quien seria— y el formulario se comporta como antes.
//
// NO se restaura solo. Se ofrece. Aplicarlo en silencio pisa datos frescos del
// servidor con datos viejos y nadie entiende por que el formulario dice otra
// cosa.
//
// AVISO para quien lo extienda: el estado del formulario puede contener valores
// que en pantalla se ven enmascarados (la ficha del miembro se inicializa con
// los datos reales aunque se pinten con asteriscos). Antes de poner `borrador`
// en un formulario con datos personales hay que filtrar los campos que su
// usuario no puede ver; por eso hoy solo lo llevan los formularios de
// estructura y tienda.
// ----------------------------------------------------------------------

const PREFIJO = 'borrador';

// Pasada esta edad el borrador se descarta solo: nadie vuelve a una ficha a
// medias de hace dos semanas, y sin caducidad `localStorage` se llena de
// formularios que ya nadie va a terminar.
export const VIGENCIA_BORRADOR_MS = 7 * 24 * 60 * 60 * 1000;

// No se escribe en cada tecla: se espera a que la persona pare de escribir.
export const RETARDO_BORRADOR_MS = 800;

const claveDeBorrador = (uid, clave) => `${PREFIJO}:${uid}:${clave}`;

const leer = (claveCompleta) => {
  try {
    const crudo = localStorage.getItem(claveCompleta);

    if (!crudo) return null;

    const guardado = JSON.parse(crudo);

    if (!guardado || typeof guardado !== 'object' || !guardado.valores) return null;

    if (Date.now() - Number(guardado.fecha || 0) > VIGENCIA_BORRADOR_MS) {
      localStorage.removeItem(claveCompleta);
      return null;
    }

    return guardado;
  } catch {
    // JSON corrupto, modo privado o almacenamiento bloqueado. Un borrador es una
    // comodidad: si no se puede leer, el formulario sigue funcionando igual.
    return null;
  }
};

const escribir = (claveCompleta, valores) => {
  try {
    localStorage.setItem(claveCompleta, JSON.stringify({ fecha: Date.now(), valores }));
  } catch {
    // Cuota llena o almacenamiento bloqueado: no se avisa. Perder el borrador no
    // puede interrumpir a quien esta escribiendo.
  }
};

const borrar = (claveCompleta) => {
  try {
    localStorage.removeItem(claveCompleta);
  } catch {
    /* nada que hacer */
  }
};

/**
 * Borra TODOS los borradores guardados en este navegador.
 *
 * Se llama al cerrar sesion: lo que quedo a medias es de quien lo escribio, y no
 * tiene por que seguir ahi para el siguiente que use el equipo.
 */
export const borrarBorradoresDeFormulario = () => {
  try {
    Object.keys(localStorage)
      .filter((clave) => clave.startsWith(`${PREFIJO}:`))
      .forEach((clave) => localStorage.removeItem(clave));
  } catch {
    /* nada que hacer */
  }
};

/**
 * Guarda lo escrito y ofrece recuperarlo.
 *
 * @param {object} methods  Lo que devuelve `useForm`.
 * @param {string} clave    Identifica el formulario Y la entidad: 'seccion:12'.
 *                          Sin clave el hook no hace nada.
 *
 * @returns {{ borrador: object|null, recuperar: function, descartar: function }}
 */
export function useFormDraft(methods, clave) {
  // `use(AuthContext)` en vez de `useAuthContext()`: ese lanza si no hay
  // proveedor, y un borrador no puede ser el motivo de que un formulario deje de
  // pintarse. Sin sesion, `uid` queda vacio y el hook se apaga solo.
  const sesion = use(AuthContext);
  const uid = String(sesion?.user?.uid || sesion?.user?.id || '').trim();
  const activo = Boolean(uid) && Boolean(clave);
  const claveCompleta = activo ? claveDeBorrador(uid, clave) : '';

  // Lo que habia guardado al abrir. Se lee UNA vez: si se releyera en cada
  // render, el propio guardado se ofreceria a si mismo para recuperar.
  const [guardado, setGuardado] = useState(null);
  const yaSeLeyo = useRef('');

  useEffect(() => {
    if (!claveCompleta || yaSeLeyo.current === claveCompleta) return;

    yaSeLeyo.current = claveCompleta;
    setGuardado(leer(claveCompleta));
  }, [claveCompleta]);

  // Escribe mientras se escribe, con retardo y solo si hay cambios sin guardar:
  // un formulario intacto no es un borrador, y ofrecer "recuperar" lo mismo que
  // ya esta en pantalla solo confunde.
  useEffect(() => {
    if (!claveCompleta) return undefined;

    let temporizador = null;

    const suscripcion = methods.watch((valores, { type }) => {
      if (!type) return;

      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        if (methods.formState.isDirty) escribir(claveCompleta, valores);
      }, RETARDO_BORRADOR_MS);
    });

    return () => {
      clearTimeout(temporizador);
      suscripcion.unsubscribe();
    };
  }, [claveCompleta, methods]);

  // Guardado con exito: lo escrito ya vive en el servidor y el borrador sobra.
  const { isSubmitSuccessful } = methods.formState;

  useEffect(() => {
    if (!claveCompleta || !isSubmitSuccessful) return;

    borrar(claveCompleta);
    setGuardado(null);
  }, [claveCompleta, isSubmitSuccessful]);

  const recuperar = useCallback(() => {
    if (!guardado?.valores) return;

    // `keepDefaultValues` conserva con que se abrio la ficha, que es contra lo
    // que se compara para saber que cambio de verdad al guardar.
    methods.reset(guardado.valores, { keepDefaultValues: true });
    setGuardado(null);
  }, [guardado, methods]);

  const descartar = useCallback(() => {
    borrar(claveCompleta);
    setGuardado(null);
  }, [claveCompleta]);

  return { borrador: guardado, recuperar, descartar };
}
