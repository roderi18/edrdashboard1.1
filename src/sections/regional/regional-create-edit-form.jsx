import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import CountrySelectApi from 'src/components/api/CountrySelectApi';
import RegionalGeneralSection from 'src/components/form/regional-form/RegionalGeneralSection';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import { usePathname } from 'next/navigation';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fData } from 'src/utils/format-number';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';
import { RegionalSchema } from 'src/models/regional-schema';
// ----------------------------------------------------------------------

export function RegionalCreateEditForm({ currentRegional }) {
  const router = useRouter();
  const pathname = usePathname();
  const isEditView = pathname.includes('/edit');

  const defaultValues = {
    name: '',
    countryId: '',
  };

  const methods = useForm({
    mode: 'onSubmit',
    resolver: zodResolver(RegionalSchema),
    defaultValues,
    values: currentRegional,
    shouldUnregister: true,
  });

  const {
    reset,
    watch,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const values = watch();

  useEffect(() => {
    if (currentRegional) {
      reset({
        ...defaultValues,
        ...currentRegional,
        regionalXSectionalCount: currentRegional?.regionalXSectionalCount ?? 0,
        regionalXSectionalXDestCount: currentRegional?.regionalXSectionalXDestCount ?? 0,
        regionalXSectionalMemberCount: currentRegional?.regionalXSectionalMemberCount ?? 0,
      });
    }
  }, [currentRegional, reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      const payload = {
        idRegion: currentRegional?.id || 0,
        nombre: data.name,
        idPais: 1,
      };

      const url = currentRegional
        ? '/api/regional/put'
        : '/api/regional/post';

      const method = currentRegional ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();

      if (!text || text.startsWith('<')) return;

      const result = JSON.parse(text);

      toast.success(
        currentRegional
          ? 'Actualizado correctamente!'
          : 'Región creada exitosamente!'
      );

      router.push('/dashboard/level/regional');
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar la región');
    }
  });

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ pt: 10, pb: 5, px: 3 }}>
            {currentRegional && (
              <Label
                color={
                  (values.status === 'active' && 'success') ||
                  (values.status === 'banned' && 'error') ||
                  'warning'
                }
                sx={{ position: 'absolute', top: 24, right: 24 }}
              >
                {values.status}
              </Label>
            )}

            <Box sx={{ mb: 5 }}>
              <Field.UploadAvatar
                name="avatarUrl"
                maxSize={1050000}
                helperText={
                  <Typography
                    variant="caption"
                    sx={{
                      mt: 3,
                      mx: 'auto',
                      display: 'block',
                      textAlign: 'center',
                      color: 'text.disabled',
                    }}
                  >
                    Permitido *.jpeg, *.jpg, *.png, *.gif
                    <br /> tamaño máximo de {fData(1050000)}
                  </Typography>
                }
              />
            </Box>

            {currentRegional && (
              <FormControlLabel
                labelPlacement="start"
                control={
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        {...field}
                        checked={field.value !== 'active'}
                        onChange={(event) =>
                          field.onChange(event.target.checked ? 'banned' : 'active')
                        }
                      />
                    )}
                  />
                }
                label={
                  <>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      Banned
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Apply disable account
                    </Typography>
                  </>
                }
                sx={{
                  mx: 0,
                  mb: 3,
                  width: 1,
                  justifyContent: 'space-between',
                }}
              />
            )}

            <Field.Switch
              name="isVerified"
              labelPlacement="start"
              label={
                <>
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    Email verified
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Disabling this will automatically send the regional a verification email
                  </Typography>
                </>
              }
              sx={{ mx: 0, width: 1, justifyContent: 'space-between' }}
            />

            {currentRegional && (
              <Stack sx={{ mt: 3, alignItems: 'center', justifyContent: 'center' }}>
                <Button variant="soft" color="error">
                  Delete regional
                </Button>
              </Stack>
            )}
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ p: 3 }}>
            <Box
              sx={{
                rowGap: 3,
                columnGap: 2,
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' },
              }}
            >
              <RegionalGeneralSection
                isCreateView={!isEditView}
                methods={methods}
                watch={watch}
              />

            </Box>

            <Stack sx={{ mt: 3, alignItems: 'flex-end' }}>
              <Button type="submit" variant="contained" loading={isSubmitting}>
                {!currentRegional ? 'Create regional' : 'Guardar cambios'}
              </Button>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </Form>
  );
}
