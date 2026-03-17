'use client';

import { useEffect, useState } from 'react';

import { DestEditLayout } from 'src/sections/dest/layout/dest-edit-layout';
import { DestCreateEditForm } from '../dest-create-edit-form';
import { getDests } from 'src/services/dest-service';
import { DESTS } from 'src/_mock/assets';
// ----------------------------------------------------------------------

export function DestEditView({ id }) {

  const [currentDest, setCurrentDest] = useState(null);

  useEffect(() => {
    const storedDests = getDests() || [];

    const dests = [...DESTS, ...storedDests];

    const dest = dests.find((d) => d.id === id);

    setCurrentDest(dest);
  }, [id]);

  if (!currentDest) return null;

  return (
    <DestCreateEditForm currentDest={currentDest} />
  );
}