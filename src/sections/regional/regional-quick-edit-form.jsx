import {
  CompactEntityQuickEditForm,
  CompactEntityQuickEditSchema,
} from 'src/sections/common/compact-entity-quick-edit-form';

// ----------------------------------------------------------------------

export const RegionalQuickEditSchema = CompactEntityQuickEditSchema;

export function RegionalQuickEditForm({ currentRegional, open, onClose }) {
  return (
    <CompactEntityQuickEditForm
      currentEntity={currentRegional}
      open={open}
      onClose={onClose}
      schema={RegionalQuickEditSchema}
    />
  );
}
