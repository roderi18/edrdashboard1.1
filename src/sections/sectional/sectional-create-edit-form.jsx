import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import { getMembers } from 'src/services/member-service';
import { useRouter } from 'src/routes/hooks';
import { getDests } from 'src/services/dest-service';
import { useEffect, useState } from 'react';
import { fData } from 'src/utils/format-number';
import { SECTIONAL_DEFAULT } from 'src/models/sectional-model';
import SectionalGeneralSection from 'src/components/form/sectional-form/SectionalGeneralSection';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';
import { saveSectional, updateSectional } from 'src/services/sectional-service';
import { SectionalCreateSchema } from 'src/models/sectional-schema';
import { getChurches } from 'src/services/church-service';
// ----------------------------------------------------------------------


export function SectionalCreateEditForm({ currentSectional }) {
  console.log('CURRENT SECTIONAL 👉', currentSectional);
  const router = useRouter();
  const [dests, setDests] = useState([]);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    async function load() {
      const membersData = await getMembers();
      const destsData = getDests();

      setMembers(membersData);
      setDests(destsData);
    }

    load();
  }, []);

  const defaultValues = SECTIONAL_DEFAULT;

  const methods = useForm({
    mode: 'onSubmit',
    resolver: zodResolver(SectionalCreateSchema),
    defaultValues,
    values: currentSectional || defaultValues,
  });


  const {
    reset,
    watch,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;
  console.log('WATCH VALUES 👉', watch());
  useEffect(() => {
    if (currentSectional && Object.keys(currentSectional).length > 0) {
      console.log('RESET DATA 👉', {
        defaultValues,
        currentSectional,
        merged: {
          ...defaultValues,
          ...currentSectional,
        },
      });
      reset({
        ...defaultValues,
        ...currentSectional,
      });
    }
  }, [currentSectional]);

  const values = watch();

  const selectedRegionalId = watch('regionalId');

  const destsBySectional = dests.filter((d) => {

    const church = getChurches().find((c) => c.id === d.churchId);
    return church?.sectionalName === watch('sectionalName');
  });

  const totalDests = destsBySectional.length;

  const totalMembers = members.filter((m) =>
    destsBySectional.some((d) => d.id === m.destId)
  ).length;

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (!data.regionalId) {
        toast.error('Debe seleccionar una región');
        return;
      }

      const payload = {
        idSeccion: currentSectional?.id || 0,
        nombre: data.sectionalName,
        idRegion: Number(data.regionalId),
      };

      if (currentSectional) {
        updateSectional(payload);
      } else {
        saveSectional(payload);
      }

      reset();
      toast.success(currentSectional ? 'Actualización exitosa!' : 'Creado correctamente!');
      router.push('/dashboard/level/sectional');
    } catch (error) {
      console.error(error);
    }
  });

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ pt: 10, pb: 5, px: 3 }}>
            {currentSectional && (
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

            {currentSectional && (
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



            {currentSectional && (
              <Stack sx={{ mt: 3, alignItems: 'center', justifyContent: 'center' }}>
                <Button variant="soft" color="error">
                  Delete sectional
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
              <SectionalGeneralSection
                methods={methods}
                watch={watch}
              />

            </Box>

            <Stack sx={{ mt: 3, alignItems: 'flex-end' }}>
              <Button type="submit" variant="contained" loading={isSubmitting}>
                {!currentSectional ? 'Crear seccional' : 'Guardar cambios'}
              </Button>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </Form>
  );
}
