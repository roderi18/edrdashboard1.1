'use client';

import { useParams } from 'next/navigation';

import { SectionalListView } from 'src/sections/sectional/view';

// ----------------------------------------------------------------------

// LAS SECCIONES DE ESTA REGION.
//
// Reutiliza la MISMA lista de secciones y solo le dice de que region. La
// visibilidad no cambia: sigue mandando el alcance de siempre.

export function RegionalSectionsView() {
  const params = useParams();
  const regionalId = String(params?.id ?? '').trim();

  return <SectionalListView regionalId={regionalId} />;
}
