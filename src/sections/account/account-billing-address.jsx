import { useMemo, useState, useCallback } from 'react';
import { useBoolean, usePopover } from 'minimal-shared/hooks';

import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Select from '@mui/material/Select';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';
import FormControl from '@mui/material/FormControl';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import barriosData from 'src/data/barrios.json';
import provinciasData from 'src/data/provincias.json';
import municipiosData from 'src/data/municipios.json';

import { Iconify } from 'src/components/iconify';
import { CustomPopover } from 'src/components/custom-popover';

import { AddressItem, AddressCreateForm } from '../address';

// ----------------------------------------------------------------------

const normalizeText = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const resolveProvinceId = (provinceName) =>
  provinciasData.find((province) => normalizeText(province.nombre) === normalizeText(provinceName))
    ?.id || '';

const getMunicipioId = (municipio, index) => municipio.id || municipio.municipioId || index + 1;

const resolveMunicipalityId = (municipalityName, provinceId) => {
  const municipioIndex = municipiosData.findIndex(
    (municipio, index) =>
      String(municipio.provinciaId) === String(provinceId) &&
      normalizeText(municipio.nombre) === normalizeText(municipalityName)
  );

  if (municipioIndex === -1) return '';

  return String(getMunicipioId(municipiosData[municipioIndex], municipioIndex));
};

const resolveSectorId = (sectorName) =>
  barriosData.find((sector) => normalizeText(sector.nombre) === normalizeText(sectorName))?.id || '';

export function AccountBillingAddress({
  addressBook,
  onSetPrimary,
  onCreateAddress,
  onUpdateAddress,
  sx,
  ...other
}) {
  const menuActions = usePopover();
  const newAddressForm = useBoolean();

  const [addressId, setAddressId] = useState('');
  const [editingAddress, setEditingAddress] = useState(null);
  const [editValues, setEditValues] = useState({
    provinceId: '',
    municipalityId: '',
    sectorId: '',
    detail: '',
  });
  const selectedAddress = addressBook.find((address) => String(address.id) === String(addressId));
  const selectedProvinceId = editValues.provinceId;
  const municipalities = useMemo(
    () =>
      municipiosData
        .map((municipio, index) => ({ ...municipio, id: getMunicipioId(municipio, index) }))
        .filter((municipio) => String(municipio.provinciaId) === String(selectedProvinceId)),
    [selectedProvinceId]
  );

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
    const provinceId = resolveProvinceId(selectedAddress.addressFields?.province);

    setEditValues({
      provinceId: String(provinceId),
      municipalityId: resolveMunicipalityId(
        selectedAddress.addressFields?.municipality,
        provinceId
      ),
      sectorId: String(resolveSectorId(selectedAddress.addressFields?.sector)),
      detail: selectedAddress.addressFields?.detail || '',
    });
    handleClose();
  }, [handleClose, selectedAddress]);

  const handleChangeEditValue = useCallback((event) => {
    const { name, value } = event.target;

    setEditValues((current) => ({
      ...current,
      [name]: value,
      ...(name === 'provinceId' ? { municipalityId: '' } : {}),
    }));
  }, []);

  const handleCloseEdit = useCallback(() => {
    setEditingAddress(null);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingAddress) return;

    const province = provinciasData.find(
      (item) => String(item.id) === String(editValues.provinceId)
    )?.nombre;
    const municipality = municipalities.find(
      (item) => String(item.id) === String(editValues.municipalityId)
    )?.nombre;
    const sector = barriosData.find((item) => String(item.id) === String(editValues.sectorId))
      ?.nombre;
    const addressFields = {
      province: province || '',
      municipality: municipality || '',
      sector: sector || '',
      detail: editValues.detail,
    };
    const fullAddress = [addressFields.province, addressFields.municipality, addressFields.sector, addressFields.detail]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(', ');

    onUpdateAddress?.(editingAddress.id, {
      fullAddress,
      addressFields,
    });
    handleCloseEdit();
  }, [editValues, editingAddress, handleCloseEdit, municipalities, onUpdateAddress]);

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
            onClick={() => {
              handleClose();
              console.info('DELETE', addressId);
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
    <Dialog fullWidth maxWidth="sm" open={Boolean(editingAddress)} onClose={handleCloseEdit}>
      <DialogTitle>Editar direccion primaria</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <FormControl fullWidth>
            <InputLabel id="billing-province-label">Provincia</InputLabel>
            <Select
              labelId="billing-province-label"
              name="provinceId"
              label="Provincia"
              value={editValues.provinceId}
              onChange={handleChangeEditValue}
            >
              {provinciasData.map((province) => (
                <MenuItem key={province.id} value={String(province.id)}>
                  {province.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="billing-municipality-label">Municipio</InputLabel>
            <Select
              labelId="billing-municipality-label"
              name="municipalityId"
              label="Municipio"
              value={editValues.municipalityId}
              onChange={handleChangeEditValue}
              disabled={!editValues.provinceId}
            >
              {municipalities.map((municipality) => (
                <MenuItem key={municipality.id} value={String(municipality.id)}>
                  {municipality.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="billing-sector-label">Sector</InputLabel>
            <Select
              labelId="billing-sector-label"
              name="sectorId"
              label="Sector"
              value={editValues.sectorId}
              onChange={handleChangeEditValue}
            >
              {barriosData.map((sector) => (
                <MenuItem key={sector.id} value={String(sector.id)}>
                  {sector.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            name="detail"
            label="Direccion"
            value={editValues.detail}
            onChange={handleChangeEditValue}
          />
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button color="inherit" variant="outlined" onClick={handleCloseEdit}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleSaveEdit}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
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
