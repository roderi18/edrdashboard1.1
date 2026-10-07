import { useRef, useEffect } from 'react';

// ----------------------------------------------------------------------
// BORRADOR DEL DISEÑO ONERRD (certificado y factura) EN ESTE NAVEGADOR.
//
// Recargar o cerrar la página perdía todo lo movido, pegado o borrado que no
// se había guardado. Ahora, mientras hay cambios sin guardar, el diseño se
// copia en `localStorage` (solo el diseño: ni datos del registro ni de
// personas) y al volver se recupera.
//
// El borrador recuerda sobre qué diseño guardado se hizo (`base`). Si al
// volver el guardado ya es otro (alguien guardó entretanto), no se aplica:
// pisaría el trabajo del otro al pulsar "Guardar diseño".
//
// `localStorage` puede fallar (ventana privada, sitio bloqueado): entonces no
// hay borrador y la pantalla sigue igual.
// ----------------------------------------------------------------------

const ESPERA_MS = 300;

const leer = (clave) => {
  try {
    const crudo = window.localStorage.getItem(clave);
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
};

const escribir = (clave, valor) => {
  try {
    if (valor) window.localStorage.setItem(clave, JSON.stringify(valor));
    else window.localStorage.removeItem(clave);
  } catch {
    // Sin almacenamiento: no hay borrador.
  }
};

// `actual` y `guardado`: el diseño saneado en JSON (lo que ya se compara para
// saber si hay cambios). `listo`: ya llegó el guardado. `onRecuperar(diseno)`.
export function useBorradorOnerrd({ clave, actual, guardado, listo, onRecuperar }) {
  const revisado = useRef(false);
  // Lo que falta escribir (undefined = nada; null = quitar el borrador).
  const pendiente = useRef(undefined);
  const recuperar = useRef(onRecuperar);
  recuperar.current = onRecuperar;

  // Al llegar el diseño guardado, una sola vez: ¿hay borrador de este?
  useEffect(() => {
    if (!listo || revisado.current) return;
    revisado.current = true;
    const borrador = leer(clave);
    if (!borrador?.diseno) return;
    if (borrador.base !== guardado || borrador.diseno === guardado) {
      escribir(clave, null);
      return;
    }
    try {
      recuperar.current(JSON.parse(borrador.diseno));
    } catch {
      escribir(clave, null);
    }
  }, [listo, clave, guardado]);

  // Cada cambio, al poco de parar; sin cambios, fuera el borrador.
  useEffect(() => {
    if (!listo || !revisado.current) return undefined;
    const valor = actual !== guardado ? { base: guardado, diseno: actual } : null;
    pendiente.current = valor;
    const temporizador = setTimeout(() => {
      escribir(clave, valor);
      pendiente.current = undefined;
    }, ESPERA_MS);
    return () => clearTimeout(temporizador);
  }, [listo, clave, actual, guardado]);

  // Si se cierra o recarga antes de que pase la espera, se escribe ya.
  useEffect(() => {
    const ahora = () => {
      if (pendiente.current !== undefined && revisado.current) {
        escribir(clave, pendiente.current);
      }
    };
    window.addEventListener('pagehide', ahora);
    return () => {
      window.removeEventListener('pagehide', ahora);
      ahora();
    };
  }, [clave]);
}
