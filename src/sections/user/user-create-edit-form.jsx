import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { isValidPhoneNumber } from 'react-phone-number-input/input';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { fData } from 'src/utils/format-number';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Form, Field, schemaUtils } from 'src/components/hook-form';

// ----------------------------------------------------------------------

export const UserCreateSchema = z.object({
  avatarUrl: schemaUtils.file({ error: 'Avatar is required!' }),
  name: z.string().min(1, { error: 'Name is required!' }),
  email: schemaUtils.email(),
  phoneNumber: schemaUtils.phoneNumber({ isValid: isValidPhoneNumber }),
  country: schemaUtils.nullableInput(z.string().min(1, { error: 'Country is required!' }), {
    error: 'Country is required!',
  }),
  address: z.string().min(1, { error: 'Address is required!' }),
  company: z.string().min(1, { error: 'Company is required!' }),
  state: z.string().min(1, { error: 'State is required!' }),
  city: z.string().min(1, { error: 'City is required!' }),
  role: z.string().min(1, { error: 'Role is required!' }),
  zipCode: z.string().min(1, { error: 'Zip code is required!' }),
  // Not required
  status: z.string(),
  isVerified: z.boolean(),
});

// ----------------------------------------------------------------------

export function UserCreateEditForm({ currentUser }) {
  const router = useRouter();

  const defaultValues = {
    status: '',
    avatarUrl: null,
    isVerified: true,
    name: '',
    email: '',
    phoneNumber: '',
    country: '',
    state: '',
    city: '',
    address: '',
    zipCode: '',
    company: '',
    role: '',
  };

  const methods = useForm({
    mode: 'onSubmit',
    resolver: zodResolver(UserCreateSchema),
    defaultValues,
    values: currentUser,
  });

  const {
    reset,
    watch,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const values = watch();

  const onSubmit = handleSubmit(async (data) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      reset();
      toast.success(currentUser ? 'Update success!' : 'Create success!');
      router.push(paths.dashboard.user.list);
      console.info('DATA', data);
    } catch (error) {
      console.error(error);
    }
  });

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ pt: 10, pb: 5, px: 3 }}>
            {currentUser && (
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
                maxSize={3145728}
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
                    <br /> tamaño máximo de {fData(3145728)}
                  </Typography>
                }
              />
            </Box>

            {currentUser && (
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
                    Disabling this will automatically send the user a verification email
                  </Typography>
                </>
              }
              sx={{ mx: 0, width: 1, justifyContent: 'space-between' }}
            />

            {currentUser && (
              <Stack sx={{ mt: 3, alignItems: 'center', justifyContent: 'center' }}>
                <Button variant="soft" color="error">
                  Delete user
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
              <Field.Text name="name" label="Nombre completo" />
              <Field.Text name="email" label="Correo electrónico" />
              <Field.Phone name="phoneNumber" label="Núm. Teléfono" defaultCountry="US" />

              <Field.CountrySelect
                fullWidth
                name="pais"
                label="País"
                placeholder="Elige una ciudad"
              />

              <Field.Text name="state" label="Provincia" />
              <Field.Text name="city" label="Ciudad" />
              <Field.Text name="address" label="Dirección" />
              <Field.Text name="zipCode" label="Código postal" />
              <Field.Text name="company" label="Company" />
              <Field.Text name="Role" label="Posición" />
            </Box>

            <Stack sx={{ mt: 3, alignItems: 'flex-end' }}>
              <Button type="submit" variant="contained" loading={isSubmitting}>
                {!currentUser ? 'Create user' : 'Guardar cambios'}
              </Button>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </Form>
  );
}
