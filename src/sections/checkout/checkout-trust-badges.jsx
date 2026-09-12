import Box from '@mui/material/Box';
import Card from '@mui/material/Card';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// LAS TRES GARANTIAS, DEBAJO DEL BOTON DE CONTINUAR.
//
// Van ahi y no arriba a proposito: es el momento de la duda —"¿le doy?"— y lo
// que se responde con esto. Arriba, con el carrito todavia a medias, no hay
// nada que tranquilizar.
//
// Son AFIRMACIONES, no adornos: cada una promete algo a quien compra. Por eso
// llegan por `items` y no escritas aqui dentro, para que la pantalla que las
// pone sea la responsable de que sean verdad —el envio gratis depende de lo que
// diga el resumen, no de este cuadro—.
// ----------------------------------------------------------------------

export function CheckoutTrustBadges({ items = [], sx }) {
  if (!items.length) return null;

  return (
    <Card
      variant="outlined"
      sx={[
        {
          mt: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'stretch',
          bgcolor: 'background.neutral',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {items.map((item, indice) => (
        <Box
          key={item.label}
          sx={{
            px: 1,
            gap: 0.75,
            minWidth: 0,
            flexGrow: 1,
            display: 'flex',
            textAlign: 'center',
            alignItems: 'center',
            flexDirection: 'column',
            justifyContent: 'center',
            // La raya va entre las tres, no alrededor: enmarcada, cada una
            // parecia un boton.
            ...(indice > 0 && {
              borderLeft: (theme) => `solid 1px ${theme.vars.palette.divider}`,
            }),
          }}
        >
          {/* LOS TRES EN EL VERDE DE LA CASA. Un dorado, un cian y un verde
              —los colores de la maqueta— eran tres colores de tres sitios: el
              cian ni siquiera es del proyecto. Y aqui el color no dice nada
              distinto en cada cuadro, como si pasa con los estados de un
              pedido: los tres prometen lo mismo, asi que van iguales y se leen
              como un bloque. */}
          <Iconify icon={item.icono} width={24} sx={{ color: 'primary.main' }} />

          <Box component="span" sx={{ typography: 'caption', color: 'text.secondary' }}>
            {item.label}
          </Box>
        </Box>
      ))}
    </Card>
  );
}
