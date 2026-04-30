'use client';

import { useState, useEffect } from 'react';

import { mapApiDestToUI } from 'src/services/dest-service';

import { DestCreateEditForm } from '../dest-create-edit-form';

// ----------------------------------------------------------------------

export function DestEditView({ id }) {

  const [currentDest, setCurrentDest] = useState(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/dest');
      const data = await res.json();

      const dest = (data?.data || []).find(
        (d) => String(d.idDestacamento) === String(id)
      );

      setCurrentDest(dest ? mapApiDestToUI(dest) : null);
    };

    load();
  }, [id]);

  if (!currentDest) return null;

  return (
    <DestCreateEditForm currentDest={currentDest} />
  );
}
