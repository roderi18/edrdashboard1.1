import {
  CompactEntityQuickEditForm,
  CompactEntityQuickEditSchema,
} from 'src/sections/common/compact-entity-quick-edit-form';

// ----------------------------------------------------------------------

export const SectionalQuickEditSchema = CompactEntityQuickEditSchema;

export function SectionalQuickEditForm({ currentSectional, open, onClose }) {
  return (
    <CompactEntityQuickEditForm
      currentEntity={currentSectional}
      open={open}
      onClose={onClose}
      schema={SectionalQuickEditSchema}
    />
  );
}
