'use client';

import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';

import { puedeVerHistoriaDeDestacamento } from 'src/utils/member-access';

import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { useLeadershipHistory } from './use-leadership-history';
import { LeadershipHistoryList } from './leadership-history-list';

// ----------------------------------------------------------------------
// LA PESTAÑA "HISTORIA" de un destacamento, sección o región. Junta a quien
// ocupa el cargo HOY con quien lo ocupó antes (30+ días), sin separar por de
// qué organigrama sale el cargo, y la pinta con la misma lista que el Consejo
// Nacional (`LeadershipHistoryList`): buscador, filtros, Lista/Cuadrícula,
// vista compacta y filas por página, como Miembros o Destacamentos.
//
// El Consejo Ejecutivo solo ve la de SU destacamento: el menú ya no le enseña
// la pestaña en los demás, y esta segunda puerta cubre a quien llega por la URL.
// ----------------------------------------------------------------------

export function LeadershipHistoryView({ nivel, idEntidad }) {
  const { user } = useAuthContext();
  const puedeVerla = nivel !== 'destacamento' || puedeVerHistoriaDeDestacamento(user, idEntidad);
  const { filas, cargando } = useLeadershipHistory({
    nivel,
    idEntidad: puedeVerla ? idEntidad : '',
  });

  if (!puedeVerla) {
    return (
      <Card sx={{ p: 5, textAlign: 'center' }}>
        <Iconify icon="solar:clock-circle-bold" width={40} sx={{ mb: 1, color: 'text.disabled' }} />
        <Typography variant="subtitle1">La historia de este destacamento no es tuya</Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
          Desde el Consejo Ejecutivo ves la historia de tu propio destacamento, y la de secciones y
          regiones.
        </Typography>
      </Card>
    );
  }

  return <LeadershipHistoryList filas={filas} cargando={cargando} />;
}
