'use client';

import { useEffect, useState } from 'react';

import { DestEditLayout } from 'src/sections/dest/layout/dest-edit-layout';
import { DestCreateEditForm } from '../dest-create-edit-form';
// ----------------------------------------------------------------------

export function DestEditView({ id }) {

  const [currentDest, setCurrentDest] = useState(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/dest');
      const data = await res.json();

      const dest = (data?.Data || []).find(
        (d) => String(d.idDestacamento) === String(id)
      );

      setCurrentDest(dest);
    };

    load();
  }, [id]);

  if (!currentDest) return null;

  return (
    <DestCreateEditForm currentDest={currentDest} />
  );
}