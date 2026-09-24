import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';

// ----------------------------------------------------------------------
// EL ESQUELETO DE CUALQUIER ORGANIGRAMA MIENTRAS LLEGA LO SUYO.
//
// El cuadro no se pinta hasta saber dónde va cada caja y quién la ocupa: con las
// posiciones de partida primero y las guardadas después se veía el organigrama
// saltar, y sin las asignaciones salía entero en "Vacante" y se llenaba luego.
// Se enseña esto y se cambia una sola vez.
//
// Tiene la forma del cuadro —una caja arriba, una fila de tres, otra sola y una
// fila ancha— para que el cambio no dé tirones. Vivía en el organigrama del
// destacamento; ahora lo usan los cuatro niveles y la Jerarquía de la lista.
// ----------------------------------------------------------------------

export function OrganigramaCargando({ sx }) {
  const caja = (clave) => (
    <Skeleton key={clave} variant="rounded" width={200} height={116} sx={{ borderRadius: 1.5 }} />
  );

  return (
    <Stack
      spacing={4}
      alignItems="center"
      aria-label="Cargando organigrama"
      aria-busy="true"
      sx={{ py: 6, width: 1, ...sx }}
    >
      <Skeleton variant="text" width={240} height={28} />

      {caja('raiz')}

      <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        {[1, 2, 3].map(caja)}
      </Stack>

      {caja('medio')}

      <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
        {[4, 5, 6, 7].map(caja)}
      </Stack>
    </Stack>
  );
}
