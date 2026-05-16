import {
  CompactEntityQuickEditForm,
  CompactEntityQuickEditSchema,
} from 'src/sections/common/compact-entity-quick-edit-form';

// ----------------------------------------------------------------------

export const MemberQuickEditSchema = CompactEntityQuickEditSchema;

export function MemberQuickEditForm({ currentMember, open, onClose }) {
  return (
    <CompactEntityQuickEditForm
      currentEntity={currentMember}
      open={open}
      onClose={onClose}
      schema={MemberQuickEditSchema}
      extraField={{ name: 'memberDivision', label: 'División' }}
    />
  );
}
