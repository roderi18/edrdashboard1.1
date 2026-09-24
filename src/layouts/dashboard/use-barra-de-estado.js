'use client';

import { useEffect } from 'react';

import { layoutClasses } from '../core/classes';

// ----------------------------------------------------------------------

// LA BARRA DE ESTADO DE ANDROID TOMA EL COLOR DE LA CABECERA.
//
// En Android (y en el Chrome de cualquier telefono) la franja de la hora no se
// puede volver transparente: la pinta el sistema con el `theme-color`. El de
// src/app/layout.jsx es el verde de la marca, y encima de la cabecera navy del
// panel quedaba una franja verde. Aqui se copia el color real de la cabecera,
// sea cual sea la paleta, para que la franja parezca parte de ella. En el
// iPhone instalado no hace falta (va translucida), pero no estorba.
//
// `claveDeRepintado` cambia cuando puede cambiar el color (modo claro/oscuro,
// paleta, ruta). Al salir del panel se devuelve el valor de siempre.
export function useBarraDeEstadoDeLaCabecera(claveDeRepintado) {
  useEffect(() => {
    const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
    const originales = metas.map((meta) => meta.getAttribute('content'));

    // Un fotograma de espera: la cabecera recibe sus variables CSS al pintarse.
    const frame = window.requestAnimationFrame(() => {
      const cabecera = document.querySelector(`.${layoutClasses.header}`);
      const color = cabecera ? window.getComputedStyle(cabecera).backgroundColor : '';

      if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return;

      metas.forEach((meta) => meta.setAttribute('content', color));
    });

    return () => {
      window.cancelAnimationFrame(frame);
      metas.forEach((meta, index) => meta.setAttribute('content', originales[index]));
    };
  }, [claveDeRepintado]);
}
