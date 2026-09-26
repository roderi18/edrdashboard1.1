import Tooltip from '@mui/material/Tooltip';

import { opcionEstatusMiembro } from 'src/utils/estatus-miembro.mjs';

import { Label } from './label';

// ----------------------------------------------------------------------

// El estatus del miembro en la esquina superior derecha de la tarjeta del perfil,
// donde estaba el chip de antes (que mostraba el valor crudo, "active"/"banned").
// La tarjeta que lo contiene lleva `position: 'relative'`. Al pasar el ratón o
// tocarlo en el celular explica qué significa.
export function ChipEstatusMiembro({ estatus, explicacion = '', sx }) {
  const opcion = opcionEstatusMiembro(estatus);

  return (
    <Tooltip
      arrow
      enterTouchDelay={0}
      // Además de qué significa, POR QUÉ está así: última presencia, faltas
      // seguidas y quién lo puso a mano. Sin esto nadie entiende por qué la
      // aplicación lo movió.
      title={[opcion.descripcion, explicacion].filter(Boolean).join(' ')}
    >
      <Label
        color={opcion.color}
        sx={[
          { position: 'absolute', top: 16, right: 16, zIndex: 1, cursor: 'default' },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {opcion.etiqueta}
      </Label>
    </Tooltip>
  );
}
