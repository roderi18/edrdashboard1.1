'use client';

import { NationalCreateEditForm } from '../national-create-edit-form';

// ----------------------------------------------------------------------

export function NationalEditView({ national: currentNational }) {
  return <NationalCreateEditForm currentNational={currentNational} />;
}
