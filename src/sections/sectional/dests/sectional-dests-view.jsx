'use client';

import { useParams } from 'next/navigation';

import { DestListView } from 'src/sections/dest/view';

// ----------------------------------------------------------------------

// LOS DESTACAMENTOS DE ESTA SECCION.
//
// Reutiliza la MISMA lista de destacamentos —sus filtros, su paginacion, sus
// tarjetas en el movil— y solo le dice de que seccion. La visibilidad no cambia:
// sigue mandando el alcance de siempre, y esta pestaña solo acota lo que ese
// alcance ya deja ver.

export function SectionalDestsView() {
  const params = useParams();
  const sectionalId = String(params?.id ?? '').trim();

  return <DestListView sectionalId={sectionalId} />;
}
