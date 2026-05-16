import {
  CompactEntityQuickEditForm,
  CompactEntityQuickEditSchema,
} from 'src/sections/common/compact-entity-quick-edit-form';

// ----------------------------------------------------------------------

export const DestQuickEditSchema = CompactEntityQuickEditSchema;

export function DestQuickEditForm({ currentDest, open, onClose }) {
  return (
    <CompactEntityQuickEditForm
      currentEntity={currentDest}
      open={open}
      onClose={onClose}
      schema={DestQuickEditSchema}
    />
  );
}
