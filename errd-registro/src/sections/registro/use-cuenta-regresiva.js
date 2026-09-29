'use client';

import { useSyncExternalStore } from 'react';

// ----------------------------------------------------------------------
// LA CUENTA ATRÁS EN VIVO (navegador).
//
// Una sola lectura compartida por la cuenta atrás de la portada y el formulario:
// se pide al abrir, cada 30 s y al volver a la pestaña, así que un cambio hecho
// en el dashboard se ve en segundos sin recargar. Se guarda la diferencia con la
// hora del servidor para contar con ella y no con el reloj del teléfono.
// ----------------------------------------------------------------------

const DE_FABRICA = {
  cierre: '2026-10-12T23:59:59-04:00',
  mostrar: true,
  texto: 'Resta para finalizar la actualización:',
  cerrarAlTerminar: false,
};

let estado = { config: DE_FABRICA, desfase: 0, cargada: false };
const oyentes = new Set();
let arrancado = false;

const avisar = () => oyentes.forEach((oyente) => oyente());

async function refrescar() {
  try {
    const antes = Date.now();
    const res = await fetch('/api/cuenta-regresiva/', { cache: 'no-store' });
    if (!res.ok) return;
    const { ahora, ...config } = await res.json();
    const despues = Date.now();
    // La hora del servidor, corregida por la mitad del viaje de ida y vuelta.
    const desfase = Number.isFinite(ahora) ? ahora - (antes + despues) / 2 : 0;
    estado = { config: { ...DE_FABRICA, ...config }, desfase, cargada: true };
    avisar();
  } catch {
    // Sin red: se sigue con lo último que llegó.
  }
}

function arrancar() {
  if (arrancado || typeof window === 'undefined') return;
  arrancado = true;
  refrescar();
  setInterval(refrescar, 30_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refrescar();
  });
}

const suscribir = (oyente) => {
  arrancar();
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
};

const leer = () => estado;
const leerEnServidor = () => estado;

/** { config, desfase, cargada }: `Date.now() + desfase` es la hora del servidor. */
export const useCuentaRegresiva = () => useSyncExternalStore(suscribir, leer, leerEnServidor);

/** "lunes 12 de octubre, 11:59 p. m." en hora de Santo Domingo. */
export const fechaDeCierre = (iso) =>
  new Intl.DateTimeFormat('es-DO', {
    timeZone: 'America/Santo_Domingo',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
