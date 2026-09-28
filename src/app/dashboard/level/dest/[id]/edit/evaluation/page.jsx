'use client';

import { useParams } from 'src/routes/hooks';

import { DestEvaluacionView } from 'src/sections/dest/view/dest-evaluacion-view';

// ----------------------------------------------------------------------

export default function Page() {
  const params = useParams();

  return <DestEvaluacionView idDestacamento={params?.id} />;
}
