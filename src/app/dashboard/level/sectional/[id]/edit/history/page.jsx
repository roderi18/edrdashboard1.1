'use client';

import { useParams } from 'src/routes/hooks';

import { LeadershipHistoryView } from 'src/sections/common/leadership-history-view';

// ----------------------------------------------------------------------

export default function Page() {
  const params = useParams();

  return <LeadershipHistoryView nivel="seccional" idEntidad={params?.id} />;
}
