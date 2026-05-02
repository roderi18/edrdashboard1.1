import { useState, useCallback } from 'react';
import { useBoolean, usePopover } from 'minimal-shared/hooks';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

import { AddressItem, AddressCreateForm } from '../address';

// ----------------------------------------------------------------------

export function AccountBillingAddress({
  addressBook,
  onSetPrimary,
  onCreateAddress,
  onUpdateAddress,
  onDeleteAddress,
  sx,
  ...other
}) {
  const menuActions = usePopover();
  const newAddressForm = useBoolean();

  const [addressId, setAddressId] = useState('');
  const [editingAddress, setEditingAddress] = useState(null);
  const selectedAddress = addressBook.find((address) => String(address.id) === String(addressId));

  const handleAddAddress = useCallback((address) => {
    onCreateAddress?.(address);
  }, [onCreateAddress]);

  const handleSelectedId = useCallback(
    (event, id) => {
      menuActions.onOpen(event);
      setAddressId(id);
    },
    [menuActions]
  );

  const handleClose = useCallback(() => {
    menuActions.onClose();
    setAddressId('');
  }, [menuActions]);

  const handleOpenEdit = useCallback(() => {
    if (!selectedAddress) return;

    setEditingAddress(selectedAddress);
    handleClose();
  }, [handleClose, selectedAddress]);

  const handleCloseEdit = useCallback(() => {
    setEditingAddress(null);
  }, []);

  const handleUpdateAddress = useCallback((address) => {
    if (!editingAddress) return;

    onUpdateAddress?.(editingAddress.id, address);
    handleCloseEdit();
  }, [editingAddress, handleCloseEdit, onUpdateAddress]);

  const renderMenuActions = () => (
    <CustomPopover open={menuActions.open} anchorEl={menuActions.anchorEl} onClose={handleClose}>
      <MenuList>
        {selectedAddress && (
          <MenuItem
            onClick={() => {
              handleClose();
              onSetPrimary?.(addressId);
            }}
          >
            <Iconify icon="eva:star-fill" />
            Usar como predeterminada
          </MenuItem>
        )}

        {selectedAddress && !selectedAddress.editLocked && (
          <MenuItem onClick={handleOpenEdit}>
            <Iconify icon="solar:pen-bold" />
            Editar
          </MenuItem>
        )}

        {selectedAddress && !selectedAddress.locked && (
          <MenuItem
            onClick={async () => {
              handleClose();
              await onDeleteAddress?.(addressId);
            }}
            sx={{ color: 'error.main' }}
          >
            <Iconify icon="solar:trash-bin-trash-bold" />
            Eliminar
          </MenuItem>
        )}
      </MenuList>
    </CustomPopover>
  );

  const renderAddressCreateForm = () => (
    <AddressCreateForm
      open={newAddressForm.value}
      onClose={newAddressForm.onFalse}
      onCreate={handleAddAddress}
    />
  );

  const renderAddressEditForm = () => (
    <AddressCreateForm
      open={Boolean(editingAddress)}
      onClose={handleCloseEdit}
      onCreate={handleUpdateAddress}
      currentAddress={editingAddress}
      title="Editar direccion primaria"
      forceHomeAddress
      slotProps={{
        submitButton: { label: 'Guardar' },
      }}
    />
  );

  return (
    <>
      <Card sx={sx} {...other}>
        <CardHeader
          title="Libreta de direcciones"
          action={
            <Button
              size="small"
              color="primary"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={newAddressForm.onTrue}
            >
              Agregar direccion
            </Button>
          }
        />

        <Stack spacing={2.5} sx={{ p: 3 }}>
          {addressBook.map((address) => (
            <AddressItem
              variant="outlined"
              key={address.id}
              address={address}
              action={
                <IconButton
                  onClick={(event) => {
                    handleSelectedId(event, `${address.id}`);
                  }}
                  sx={{ position: 'absolute', top: 8, right: 8 }}
                >
                  <Iconify icon="eva:more-vertical-fill" />
                </IconButton>
              }
              sx={{ p: 2.5, borderRadius: 1 }}
            />
          ))}
        </Stack>
      </Card>

      {renderMenuActions()}
      {renderAddressCreateForm()}
      {renderAddressEditForm()}
    </>
  );
}
