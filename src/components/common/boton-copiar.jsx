import { useState, useCallback } from 'react';

import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// Copia al portapapeles EXACTAMENTE el valor que se le pasa, no el texto que
// haya alrededor: asi se puede mostrar "Miembro EDR-10002" y copiar solo el
// codigo.
//
// Y AVISA SI NO PUDO. Antes ponia el visto verde pasara lo que pasara: el plan B
// no comprobaba si habia copiado algo, asi que un fallo se veia igual que un
// exito y solo se descubria al pegar. De ahi lo de darle tres veces al boton
// creyendo que no habia pulsado bien.
// ----------------------------------------------------------------------

const CONFIRMACION_MS = 1500;

/**
 * El camino moderno. Pide el portapapeles al navegador.
 *
 * Falla —y hay que dejarle fallar— si la pestaña no tiene el foco, si el sitio
 * no va por HTTPS o si el permiso esta denegado.
 */
const copiarConApi = async (texto) => {
  if (!navigator?.clipboard?.writeText) return false;

  // Sin foco, el navegador rechaza la escritura con
  // `NotAllowedError: Document is not focused`. Esa es LA causa del "a veces si
  // y a veces no": basta con que el foco lo tenga otra ventana, el inspector o
  // un iframe. Se intenta, y si se queja por eso se recupera el foco y se
  // reintenta UNA vez.
  for (let intento = 0; intento < 2; intento += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await navigator.clipboard.writeText(texto);

      return true;
    } catch (error) {
      const puedeSerElFoco =
        error?.name === 'NotAllowedError' && typeof window !== 'undefined' && intento === 0;

      if (!puedeSerElFoco) return false;

      window.focus();
      document.body?.focus?.();
    }
  }

  return false;
};

/**
 * El camino de siempre, para cuando el otro no esta disponible.
 *
 * Devuelve si copio DE VERDAD: `execCommand` responde con un booleano que antes
 * se tiraba a la basura. Al campo hay que darle el foco ademas de seleccionarlo
 * —solo con `select()` no basta en varios navegadores— y en iOS la seleccion se
 * hace con `setSelectionRange`.
 */
const copiarConCampoOculto = (texto) => {
  if (typeof document === 'undefined') return false;

  const activoAntes = document.activeElement;
  const campo = document.createElement('textarea');

  campo.value = texto;
  campo.setAttribute('readonly', '');
  campo.contentEditable = 'true';
  // Fuera de la vista pero NO oculto: un elemento con `display:none` o
  // `visibility:hidden` no se puede seleccionar, y entonces no se copia nada.
  campo.style.position = 'fixed';
  campo.style.top = '0';
  campo.style.left = '0';
  campo.style.width = '1px';
  campo.style.height = '1px';
  campo.style.padding = '0';
  campo.style.border = 'none';
  campo.style.outline = 'none';
  campo.style.boxShadow = 'none';
  campo.style.background = 'transparent';

  document.body.appendChild(campo);

  let copiado = false;

  try {
    campo.focus();
    campo.select();
    campo.setSelectionRange(0, texto.length);
    copiado = document.execCommand('copy');
  } catch {
    copiado = false;
  } finally {
    document.body.removeChild(campo);

    // Devolver el foco a donde estaba: si no, el siguiente clic se pierde
    // recuperandolo y parece que el boton no responde.
    if (activoAntes && typeof activoAntes.focus === 'function') {
      activoAntes.focus();
    }
  }

  return copiado;
};

export function BotonCopiar({ valor, titulo = 'Copiar', sx }) {
  const [estado, setEstado] = useState('listo');

  const copiar = useCallback(async () => {
    const texto = String(valor ?? '');

    if (!texto) return;

    const copiado = (await copiarConApi(texto)) || copiarConCampoOculto(texto);

    setEstado(copiado ? 'copiado' : 'fallo');
    setTimeout(() => setEstado('listo'), CONFIRMACION_MS);
  }, [valor]);

  const { icono, color, mensaje } = {
    listo: { icono: 'solar:copy-bold', color: 'text.secondary', mensaje: titulo },
    copiado: { icono: 'solar:check-circle-bold', color: 'success.main', mensaje: 'Copiado' },
    fallo: {
      icono: 'solar:danger-circle-bold',
      color: 'error.main',
      // Sin mentir y con salida: el codigo se pinta con `user-select: all`, asi
      // que un clic encima lo selecciona entero y ya solo queda Ctrl+C.
      mensaje: 'No se pudo copiar. Haz clic sobre el código para seleccionarlo y pulsa Ctrl+C.',
    },
  }[estado];

  return (
    <Tooltip title={mensaje} placement="top" arrow>
      <IconButton
        size="small"
        onClick={copiar}
        aria-label={titulo}
        sx={[{ p: 0.25, flexShrink: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}
      >
        <Iconify width={16} icon={icono} sx={{ color }} />
      </IconButton>
    </Tooltip>
  );
}
