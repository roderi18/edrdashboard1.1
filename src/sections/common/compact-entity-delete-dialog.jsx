import { ConfirmEscribiendoDialog } from 'src/components/custom-dialog';

// ----------------------------------------------------------------------

export function CompactEntityDeleteDialog({
  open,
  onClose,
  onConfirm,
  selectedCount,
  entityLabel,
  title = 'Eliminar',
}) {
  return (
    <ConfirmEscribiendoDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      content={
        <>
          ¿Seguro que deseas eliminar <strong> {selectedCount} </strong> {entityLabel}?
        </>
      }
    />
  );
}
