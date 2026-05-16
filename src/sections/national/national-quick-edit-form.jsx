import {
  CompactEntityQuickEditForm,
  CompactEntityQuickEditSchema,
} from 'src/sections/common/compact-entity-quick-edit-form';

// ----------------------------------------------------------------------

export const NationalQuickEditSchema = CompactEntityQuickEditSchema;

export function NationalQuickEditForm({ currentNational, open, onClose }) {
  return (
    <CompactEntityQuickEditForm
      currentEntity={currentNational}
      open={open}
      onClose={onClose}
      schema={NationalQuickEditSchema}
    />
  );
}
