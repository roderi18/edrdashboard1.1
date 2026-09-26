'use client';

import { useLeadershipHistory } from './use-leadership-history';
import { LeadershipHistoryList } from './leadership-history-list';

// ----------------------------------------------------------------------
// LA PESTAÑA "HISTORIA" de un destacamento, sección o región. Junta a quien
// ocupa el cargo HOY con quien lo ocupó antes (30+ días), sin separar por de
// qué organigrama sale el cargo, y la pinta con la misma lista que el Consejo
// Nacional (`LeadershipHistoryList`): buscador, filtros, Lista/Cuadrícula,
// vista compacta y filas por página, como Miembros o Destacamentos.
// ----------------------------------------------------------------------

export function LeadershipHistoryView({ nivel, idEntidad }) {
  const { filas, cargando } = useLeadershipHistory({ nivel, idEntidad });

  return <LeadershipHistoryList filas={filas} cargando={cargando} />;
}
