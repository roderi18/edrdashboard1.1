import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
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

import { useRouter } from 'src/routes/hooks';

import { subirFotoEntidad } from 'src/utils/firebase-photos';
import { canManageOrgLevels } from 'src/utils/admin-role-label';
import { getImageOptimizationMessage } from 'src/utils/upload-optimization-message';

import { AUTH } from 'src/lib/firebase';
import { RegionalSchema } from 'src/models/regional-schema';
import { saveRegional, updateRegional } from 'src/services/regional-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';
import { EntityInfoPdfMenu } from 'src/components/info/entity-info-pdf-menu';
import RegionalGeneralSection from 'src/components/form/regional-form/RegionalGeneralSection';

import { useAuthContext } from 'src/auth/hooks';
// ----------------------------------------------------------------------

const DEFAULT_VALUES = {
  name: '',
  countryId: '1',
  regionalXSectionalCount: 0,
  regionalXSectionalXDestCount: 0,
  regionalXSectionalMemberCount: 0,
};

export function RegionalCreateEditForm({ currentRegional }) {
  const router = useRouter();
  const { user } = useAuthContext();
  // Solo administrador global/funcional puede editar; el resto navega y consulta
  // la region en modo de solo lectura.
  const canEdit = canManageOrgLevels(user);
  const pathname = usePathname();
  const isEditView = pathname.includes('/edit');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const methods = useForm({
    mode: 'onSubmit',
    resolver: zodResolver(RegionalSchema),
    defaultValues: DEFAULT_VALUES,
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

  const handleUploadRegionalPhoto = async (acceptedFiles) => {
    const file = acceptedFiles?.[0];
    const regionalId = currentRegional?.id;

    if (!currentRegional || !regionalId) {
      toast.error('Primero guarda la region antes de subir una foto.');
      return null;
    }

    try {
      setUploadingPhoto(true);

      const photo = await subirFotoEntidad({
        file,
        tipoEntidad: 'region',
        idEntidad: regionalId,
        tipoFoto: 'perfil',
        subidoPor: AUTH.currentUser?.uid || '',
      });

      toast.success(getImageOptimizationMessage(file.__optimizationInfo));

      return photo.urlFoto;
    } catch (error) {
      console.error('[regional form] photo upload failed', error);
      toast.error(error.message || 'No se pudo subir la foto.');
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  useEffect(() => {
    if (currentRegional) {
      reset({
        ...DEFAULT_VALUES,
        ...currentRegional,
        regionalXSectionalCount: currentRegional?.regionalXSectionalCount ?? 0,
        regionalXSectionalXDestCount: currentRegional?.regionalXSectionalXDestCount ?? 0,
        regionalXSectionalMemberCount: currentRegional?.regionalXSectionalMemberCount ?? 0,
      });
    }
  }, [currentRegional, reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (!canEdit) {
        return;
      }

      const payload = {
        idRegion: currentRegional?.id || 0,
        nombre: data.name,
        idPais: Number(data.countryId) || 1,
        idCargoInstitucional: Number(data.idCargoInstitucional) || null,
      };

      if (currentRegional) {
        await updateRegional(payload, { usuario: user, antes: currentRegional });
      } else {
        await saveRegional(payload, { usuario: user });
      }

      toast.success(
        currentRegional
          ? 'Actualizado correctamente!'
          : 'Región creada exitosamente!'
      );

      if (currentRegional) {
        router.refresh();
        return;
      }

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
                loading={uploadingPhoto}
                disabled={uploadingPhoto || !canEdit}
                onDrop={handleUploadRegionalPhoto}
                optimizationToast={false}
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
                    <br /> la imagen se optimiza al cargar.
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
                        disabled={!canEdit}
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

            {currentRegional && (
              <Stack sx={{ mt: 3, alignItems: 'center', justifyContent: 'center' }}>
                <EntityInfoPdfMenu
                  title={values.name || currentRegional?.name || 'Región'}
                  subtitle={`Región ${currentRegional?.id || ''}`}
                  avatarUrl={values.avatarUrl}
                  fileName={`region-${currentRegional?.id || 'info'}.pdf`}
                  sections={[
                    {
                      value: 'general',
                      label: 'General',
                      required: true,
                      rows: [
                        { label: 'Nombre', value: values.name },
                        { label: 'ID', value: currentRegional?.id },
                        { label: 'País', value: values.countryId || 'República Dominicana' },
                        { label: 'Secciones', value: values.regionalXSectionalCount },
                        { label: 'Destacamentos', value: values.regionalXSectionalXDestCount },
                        { label: 'Miembros', value: values.regionalXSectionalMemberCount },
                      ],
                    },
                    // El admin de destacamento solo puede descargar la informacion General.
                    ...(canEdit
                      ? [
                          {
                            value: 'secciones',
                            label: 'Secciones',
                            rows: [{ label: 'Cantidad', value: values.regionalXSectionalCount }],
                          },
                          {
                            value: 'destacamentos',
                            label: 'Destacamentos',
                            rows: [
                              { label: 'Cantidad', value: values.regionalXSectionalXDestCount },
                            ],
                          },
                          {
                            value: 'miembros',
                            label: 'Miembros',
                            rows: [
                              { label: 'Cantidad', value: values.regionalXSectionalMemberCount },
                            ],
                          },
                        ]
                      : []),
                  ]}
                />
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
                disabled={!canEdit}
              />

            </Box>

            {canEdit && (
              <Stack sx={{ mt: 3, alignItems: 'flex-end' }}>
                <Button type="submit" variant="contained" loading={isSubmitting}>
                  {!currentRegional ? 'Crear Región' : 'Guardar cambios'}
                </Button>
              </Stack>
            )}
          </Card>
        </Grid>
      </Grid>
    </Form>
  );
}
