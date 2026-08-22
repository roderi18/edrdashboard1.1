import { useState } from 'react';

import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// Copia al portapapeles EXACTAMENTE el valor que se le pasa, no el texto que
// haya alrededor: asi se puede mostrar "Miembro EDR-10002" y copiar solo el
// codigo. Confirma con un cambio de icono durante segundo y medio.
// ----------------------------------------------------------------------

export function BotonCopiar({ valor, titulo = 'Copiar', sx }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(String(valor));
    } catch {
      // Navegadores sin portapapeles (o sin permiso): se selecciona el texto en
      // un campo oculto y se copia con el metodo de siempre.
      const campo = document.createElement('textarea');

      campo.value = String(valor);
      campo.setAttribute('readonly', '');
      campo.style.position = 'fixed';
      campo.style.opacity = '0';
      document.body.appendChild(campo);
      campo.select();
      document.execCommand('copy');
      document.body.removeChild(campo);
    }

    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };

  return (
    <Tooltip title={copiado ? 'Copiado' : titulo} placement="top" arrow>
      <IconButton
        size="small"
        onClick={copiar}
        aria-label={`Copiar ${valor}`}
        sx={[{ p: 0.25, flexShrink: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}
      >
        <Iconify
          width={16}
          icon={copiado ? 'solar:check-circle-bold' : 'solar:copy-bold'}
          sx={{ color: copiado ? 'success.main' : 'text.secondary' }}
        />
      </IconButton>
    </Tooltip>
  );
}
