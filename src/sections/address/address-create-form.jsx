import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { useMemo, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { isValidPhoneNumber } from 'react-phone-number-input/input';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import barriosData from 'src/data/barrios.json';
import provinciasData from 'src/data/provincias.json';
import municipiosData from 'src/data/municipios.json';

import { Form, Field, schemaUtils } from 'src/components/hook-form';

// ----------------------------------------------------------------------

export const AddressCreateSchema = z.object({
  name: z.string().min(1, { error: 'El nombre es obligatorio.' }),
  provinceId: z.string().min(1, { error: 'La provincia es obligatoria.' }),
  municipioId: z.string().min(1, { error: 'El municipio es obligatorio.' }),
  sectorId: z.string().min(1, { error: 'El sector es obligatorio.' }),
  street: z.string().min(1, { error: 'La direccion es obligatoria.' }),
  phoneNumber: schemaUtils.phoneNumber({ isValid: isValidPhoneNumber }),
  // Not required
  primary: z.boolean(),
  addressType: z.string(),
});

// ----------------------------------------------------------------------

const getMunicipioId = (municipio, index) => municipio.id || municipio.municipioId || index + 1;

const normalizeText = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const resolveProvinceId = (provinceName) =>
  provinciasData.find((province) => normalizeText(province.nombre) === normalizeText(provinceName))
    ?.id || '';

const resolveMunicipioId = (municipalityName, provinceId, municipios) =>
  municipios.find(
    (municipio) =>
      String(municipio.provinciaId) === String(provinceId) &&
      normalizeText(municipio.nombre) === normalizeText(municipalityName)
  )?.id || '';

const resolveSectorId = (sectorName) =>
  barriosData.find((sector) => normalizeText(sector.nombre) === normalizeText(sectorName))?.id || '';

export function AddressCreateForm({
  open,
  onClose,
  onCreate,
  currentAddress,
  title = 'Agregar direccion',
  forceHomeAddress = false,
  slotProps,
  sx,
  ...other
}) {
  const defaultValues = {
    name: '',
    provinceId: '',
    municipioId: '',
    sectorId: '',
    street: '',
    primary: true,
    phoneNumber: '',
    addressType: 'Casa',
  };

  const methods = useForm({
    mode: 'all',
    resolver: zodResolver(AddressCreateSchema),
    defaultValues,
  });

  const {
    watch,
    setValue,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;
  const selectedProvinceId = watch('provinceId');
  const municipios = useMemo(
    () => municipiosData.map((municipio, index) => ({ ...municipio, id: getMunicipioId(municipio, index) })),
    []
  );
  const filteredMunicipios = useMemo(
    () => municipios.filter((municipio) => String(municipio.provinciaId) === String(selectedProvinceId)),
    [municipios, selectedProvinceId]
  );

  useEffect(() => {
    if (!open || !currentAddress) return;

    const provinceId = resolveProvinceId(currentAddress.addressFields?.province);
    const municipioId = resolveMunicipioId(
      currentAddress.addressFields?.municipality,
      provinceId,
      municipios
    );

    methods.reset({
      name: currentAddress.name || '',
      phoneNumber: currentAddress.phoneNumber || '',
      addressType: currentAddress.addressType || 'Casa',
      provinceId: provinceId ? String(provinceId) : '',
      municipioId: municipioId ? String(municipioId) : '',
      sectorId: String(resolveSectorId(currentAddress.addressFields?.sector)),
      street: currentAddress.addressFields?.detail || '',
      primary: Boolean(currentAddress.primary),
      ...(forceHomeAddress ? { addressType: 'Casa' } : {}),
    });
  }, [currentAddress, forceHomeAddress, methods, municipios, open]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      const province = provinciasData.find((item) => String(item.id) === String(data.provinceId));
      const municipio = municipios.find((item) => String(item.id) === String(data.municipioId));
      const sector = barriosData.find((item) => String(item.id) === String(data.sectorId));
      const addressFields = {
        province: province?.nombre || '',
        municipality: municipio?.nombre || '',
        sector: sector?.nombre || '',
        detail: data.street,
      };

      onCreate({
        name: data.name,
        phoneNumber: data.phoneNumber,
        fullAddress: [
          addressFields.province,
          addressFields.municipality,
          addressFields.sector,
          addressFields.detail,
        ]
          .filter(Boolean)
          .join(', '),
        addressFields,
        addressType: data.addressType,
        primary: data.primary,
      });
      onClose();
    } catch (error) {
      console.error(error);
    }
  });

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={open}
      onClose={onClose}
      slotProps={slotProps}
      sx={sx}
      {...other}
    >
      <Form methods={methods} onSubmit={onSubmit}>
        <DialogTitle>{title}</DialogTitle>

        <DialogContent dividers>
          <Stack spacing={3}>
            <Field.RadioGroup
              row
              name="addressType"
              options={
                forceHomeAddress
                  ? [{ label: 'Casa', value: 'Casa' }]
                  : [
                      { label: 'Casa', value: 'Casa' },
                      { label: 'Oficina', value: 'Oficina' },
                    ]
              }
            />

            <Box
              sx={{
                rowGap: 3,
                columnGap: 2,
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' },
              }}
            >
              <Field.Text name="name" label="Nombre completo" />
              <Field.Phone name="phoneNumber" label="Num. telefono" defaultCountry="DO" />
            </Box>

            <Box
              sx={{
                rowGap: 3,
                columnGap: 2,
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' },
              }}
            >
              <Field.Autocomplete
                name="provinceId"
                label="Provincia"
                options={provinciasData}
                getOptionLabel={(option) => option?.nombre || ''}
                isOptionEqualToValue={(option, value) => String(option.id) === String(value?.id)}
                value={
                  provinciasData.find((province) => String(province.id) === watch('provinceId')) ||
                  null
                }
                onChange={(event, option) => {
                  setValue('provinceId', option?.id ? String(option.id) : '');
                  setValue('municipioId', '');
                  setValue('sectorId', '');
                }}
              />

              <Field.Autocomplete
                name="municipioId"
                label="Municipio"
                options={filteredMunicipios}
                getOptionLabel={(option) => option?.nombre || ''}
                isOptionEqualToValue={(option, value) => String(option.id) === String(value?.id)}
                value={
                  municipios.find((municipio) => String(municipio.id) === watch('municipioId')) ||
                  null
                }
                noOptionsText={watch('provinceId') ? 'Sin opciones' : 'Primero elegir Provincia'}
                onChange={(event, option) => {
                  setValue('municipioId', option?.id ? String(option.id) : '');
                  setValue('sectorId', '');
                }}
              />
            </Box>

            <Field.Autocomplete
              name="sectorId"
              label="Sector"
              options={barriosData}
              getOptionLabel={(option) => option?.nombre || ''}
              isOptionEqualToValue={(option, value) => String(option.id) === String(value?.id)}
              value={barriosData.find((sector) => String(sector.id) === watch('sectorId')) || null}
              onChange={(event, option) => {
                setValue('sectorId', option?.id ? String(option.id) : '');
              }}
            />

            <Field.Text name="street" label="Direccion" />
            <Field.Checkbox name="primary" label="Usar esta direccion como predeterminada." />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button color="inherit" variant="outlined" onClick={onClose} {...slotProps?.cancelButton}>
            {slotProps?.cancelButton?.label ?? 'Cancelar'}
          </Button>
          <Button
            type="submit"
            variant="contained"
            loading={isSubmitting}
            {...slotProps?.submitButton}
          >
            {slotProps?.submitButton?.label ?? 'Agregar'}
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  );
}
