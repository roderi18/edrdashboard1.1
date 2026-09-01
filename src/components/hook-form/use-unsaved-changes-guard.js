'use client';

import { useRef, useEffect } from 'react';

// ----------------------------------------------------------------------
// Un solo guardia para TODOS los formularios montados. Una pantalla puede tener
// mas de uno; preguntar una vez basta aunque haya dos formularios sucios.

const MENSAJE = 'Tienes cambios sin guardar. Si sales ahora, se perderán.';
const guardias = new Map();

let quitarListeners = null;
let navegacionConfirmadaPorClick = false;

const hayCambiosPendientes = () => [...guardias.values()].some((estaActivo) => estaActivo());

const confirmarSalida = () => globalThis.confirm(MENSAJE);

const instalarListeners = () => {
  if (quitarListeners || typeof window === 'undefined') return;

  const antesDeSalir = (event) => {
    if (!hayCambiosPendientes()) return;

    event.preventDefault();
    event.returnValue = '';
  };

  const alPulsarEnlace = (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const enlace = event.target?.closest?.('a[href]');
    if (!enlace || enlace.target === '_blank' || enlace.hasAttribute('download')) return;

    const destino = new URL(enlace.href, window.location.href);
    const actual = new URL(window.location.href);
    if (destino.href === actual.href || (destino.pathname === actual.pathname && destino.hash)) return;
    if (!hayCambiosPendientes()) return;

    if (!confirmarSalida()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    // Chromium dispara luego `navigate` por el mismo clic. Ya se confirmo aqui.
    navegacionConfirmadaPorClick = true;
    queueMicrotask(() => {
      navegacionConfirmadaPorClick = false;
    });
  };

  const alNavegar = (event) => {
    if (!event.cancelable || !hayCambiosPendientes()) return;
    if (navegacionConfirmadaPorClick) return;

    if (!confirmarSalida()) event.preventDefault();
  };

  window.addEventListener('beforeunload', antesDeSalir);
  document.addEventListener('click', alPulsarEnlace, true);
  window.navigation?.addEventListener?.('navigate', alNavegar);

  quitarListeners = () => {
    window.removeEventListener('beforeunload', antesDeSalir);
    document.removeEventListener('click', alPulsarEnlace, true);
    window.navigation?.removeEventListener?.('navigate', alNavegar);
    quitarListeners = null;
  };
};

export function useUnsavedChangesGuard(methods, enabled = true) {
  const activo = useRef(false);
  const id = useRef(Symbol('formulario-con-cambios'));
  const { isDirty, isSubmitting } = methods?.formState ?? {};

  // Durante el submit se deja navegar: muchos guardados redirigen al terminar.
  // Al terminar, los formularios llaman `reset` y limpian isDirty. No se usa
  // isSubmitSuccessful: React Hook Form lo conserva y ocultaria cambios nuevos
  // escritos despues del primer guardado.
  activo.current = Boolean(enabled && isDirty && !isSubmitting);

  useEffect(() => {
    const guardId = id.current;

    guardias.set(guardId, () => activo.current);
    instalarListeners();

    return () => {
      guardias.delete(guardId);
      if (!guardias.size) quitarListeners?.();
    };
  }, []);
}

export { MENSAJE as MENSAJE_CAMBIOS_SIN_GUARDAR };

export const puedeDescartarCambios = (methods) =>
  !methods?.formState?.isDirty || confirmarSalida();
