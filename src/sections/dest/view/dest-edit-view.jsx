'use client';

import { useState, useEffect } from 'react';

import { getDestsApi } from 'src/services/dest-service';

import { DestCreateEditForm } from '../dest-create-edit-form';

// ----------------------------------------------------------------------

export function DestEditView({ id }) {

  const [currentDest, setCurrentDest] = useState(null);

  useEffect(() => {
    const load = async () => {
      const dests = await getDestsApi();
      const dest = (Array.isArray(dests) ? dests : []).find((item) => String(item.id) === String(id));

      setCurrentDest(dest || null);
    };

    load();
  }, [id]);

  if (!currentDest) return null;

  return (
    <DestCreateEditForm currentDest={currentDest} />
  );
}
