import { useState, useEffect } from 'react';
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
import { getImageOptimizationMessage } from 'src/utils/upload-optimization-message';
import {
  canEditSectional,
  getRegionScopeIds,
  isRegionScopedManager,
  canAssignSectionalToRegion,
  canCreateSectionalInRegion,
} from 'src/utils/org-level-access';

import { AUTH } from 'src/lib/firebase';
import { SECTIONAL_DEFAULT } from 'src/models/sectional-model';
import { getChurches } from 'src/services/church-service';
import { getRegionals } from 'src/services/regional-service';
import { SectionalCreateSchema } from 'src/models/sectional-schema';
import { getSectionals, saveSectional, updateSectional } from 'src/services/sectional-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';
import { EntityInfoPdfMenu } from 'src/components/info/entity-info-pdf-menu';
import SectionalGeneralSection from 'src/components/form/sectional-form/SectionalGeneralSection';

import { useAuthContext } from 'src/auth/hooks';
import { PERMISOS, puedeModificar } from 'src/auth/permissions';

// ----------------------------------------------------------------------

export function SectionalCreateEditForm({ currentSectional }) {
  const router = useRouter();
  const { user } = useAuthContext();
  // Crear: admin de region (en su region) o global/funcional. Se habilita tambien
  // por el permiso `secciones.crear` del catalogo (coordinador regional y su
  // asistente), coherente con el formulario de crear destacamento; la region se
  // acota en el propio formulario/guardado.
  // Editar: admin de seccion (su seccion), admin de region (secciones de su
  // region) o global/funcional. El resto consulta en modo de solo lectura.
  const canEdit = currentSectional
    ? canEditSectional(user, currentSectional)
    : canCreateSectionalInRegion(user) || puedeModificar(user, PERMISOS.SECCIONES_CREAR);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [dests, setDests] = useState([]);
  const [churches, setChurches] = useState([]);
  const [sectionals, setSectionals] = useState([]);
  const [regionals, setRegionals] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const loadCatalogs = async () => {
      const [regionalsData, sectionalsData, churchesData] = await Promise.all([
        getRegionals(),
        getSectionals(),
        getChurches(),
      ]);
      let destsData = [];
      try {
        const res = await fetch('/api/dest');
        const json = await res.json();
        destsData = Array.isArray(json?.data) ? json.data : Array.isArray(json?.Data) ? json.Data : [];
      } catch {
        destsData = [];
      }

      if (cancelled) return;
      setRegionals(Array.isArray(regionalsData) ? regionalsData : []);
      setSectionals(Array.isArray(sectionalsData) ? sectionalsData : []);
      setChurches(Array.isArray(churchesData) ? churchesData : []);
      setDests(destsData);
    };

    loadCatalogs();
    return () => {
      cancelled = true;
    };
  }, []);

  // Región a la que pertenece el coordinador regional que crea la sección. Se
  // resuelve, en orden: por director, por alcance, y por su membresía
  // (destacamento → iglesia → sección → región). Con ella se bloquea el campo.
  const ownRegional = (() => {
    if (currentSectional || !isRegionScopedManager(user) || !regionals.length) return null;

    const findRegional = (regionId) =>
      regionId !== null && regionId !== undefined && regionId !== ''
        ? regionals.find(
            (r) => String(r.regionId) === String(regionId) || String(r.id) === String(regionId)
          )
        : null;

    const userKeys = [user?.idMiembros, user?.id, user?.memberId, user?.codigoMiembro]
      .filter((value) => value !== null && value !== undefined && value !== '')
      .map((value) => String(value));

    const byDirector = regionals.find(
      (r) => r.directorId && userKeys.includes(String(r.directorId))
    );
    if (byDirector) return byDirector;

    const scopeIds = getRegionScopeIds(user);
    const byScope = regionals.find(
      (r) => scopeIds.has(String(r.regionId)) || scopeIds.has(String(r.id))
    );
    if (byScope) return byScope;

    const userDestId = user?.destId ?? user?.idDestacamento;
    const userDest = userDestId
      ? dests.find((d) => String(d?.idDestacamento ?? d?.id) === String(userDestId))
      : null;
    const userChurchId = userDest?.idIglesia ?? userDest?.churchId;
    const userChurch =
      userChurchId != null
        ? churches.find((c) =>
            [c?.idIglesia, c?.id].some((value) => String(value) === String(userChurchId))
          )
        : null;
    const userSectionId = userChurch?.idSeccion ?? userChurch?.sectionId;
    const userSectional =
      userSectionId != null
        ? sectionals.find(
            (s) => String(s.idSeccion) === String(userSectionId) || String(s.id) === String(userSectionId)
          )
        : null;

    return findRegional(userSectional?.regionalId);
  })();

  useEffect(() => {
    if (ownRegional?.regionId != null) {
      methods.setValue('regionalId', String(ownRegional.regionId), {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownRegional?.regionId]);

  const methods = useForm({
    mode: 'onSubmit',
    resolver: zodResolver(SectionalCreateSchema),
    defaultValues: SECTIONAL_DEFAULT,
  });

  const {
    reset,
    watch,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (currentSectional && Object.keys(currentSectional).length > 0) {
      reset({
        ...SECTIONAL_DEFAULT,
        ...currentSectional,
      });
    }
  }, [currentSectional, reset]);

  const values = watch();

  const resolveSectionalId = async (sectionalName, regionalId) => {
    if (currentSectional?.id) return currentSectional.id;

    const sectionals = await getSectionals();
    const savedSectional = sectionals.find(
      (sectional) =>
        String(sectional?.sectionalName || '').trim().toLowerCase() === String(sectionalName || '').trim().toLowerCase() &&
        String(sectional?.regionalId || '') === String(regionalId || '')
    );

    return savedSectional?.id || savedSectional?.idSeccion || null;
  };

  const handleUploadSectionalPhoto = async (acceptedFiles) => {
    const file = acceptedFiles?.[0];
    const sectionalId = currentSectional?.id;

    if (!currentSectional || !sectionalId) {
      toast.error('Primero guarda la seccion antes de subir una foto.');
      return null;
    }

    try {
      setUploadingPhoto(true);

      const photo = await subirFotoEntidad({
        file,
        tipoEntidad: 'seccion',
        idEntidad: sectionalId,
        tipoFoto: 'perfil',
        subidoPor: AUTH.currentUser?.uid || '',
      });

      toast.success(getImageOptimizationMessage(file.__optimizationInfo));

      return photo.urlFoto;
    } catch (error) {
      console.error('[sectional form] photo upload failed', error);
      toast.error(error.message || 'No se pudo subir la foto.');
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (!canEdit) {
        return;
      }

      if (!data.regionalId) {
        toast.error('Debe seleccionar una región');
        return;
      }

      // Un coordinador regional acotado puede asignar la sección a SU región
      // resuelta (ownRegional), aunque el alcance de la sesión no la traiga.
      const esRegionPropia =
        ownRegional?.regionId != null &&
        String(data.regionalId) === String(ownRegional.regionId);

      if (!esRegionPropia && !canAssignSectionalToRegion(user, data.regionalId)) {
        toast.error('No tienes permiso para asignar esta sección a esa región.');
        return;
      }

      const payload = {
        idSeccion: currentSectional?.id || 0,
        nombre: data.sectionalName,
        idRegion: Number(data.regionalId),
      };

      if (currentSectional) {
        await updateSectional(payload, { usuario: user, antes: currentSectional });
      } else {
        await saveSectional(payload, { usuario: user });
      }

      toast.success(currentSectional ? 'Actualizado correctamente!' : 'Creado correctamente!');

      if (currentSectional) {
        router.refresh();
        return;
      }

      reset();
      router.push('/dashboard/level/sectional');
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar la sección');
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
                loading={uploadingPhoto}
                disabled={uploadingPhoto || !canEdit}
                onDrop={handleUploadSectionalPhoto}
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

            {currentSectional && (
              <Stack sx={{ mt: 3, alignItems: 'center', justifyContent: 'center' }}>
                <EntityInfoPdfMenu
                  title={values.sectionalName || currentSectional?.sectionalName || 'Sección'}
                  subtitle={`Sección ${currentSectional?.id || ''}`}
                  avatarUrl={values.avatarUrl}
                  fileName={`seccion-${currentSectional?.id || 'info'}.pdf`}
                  sections={[
                    {
                      value: 'general',
                      label: 'General',
                      required: true,
                      rows: [
                        { label: 'Nombre', value: values.sectionalName },
                        { label: 'ID', value: currentSectional?.id },
                        { label: 'Región', value: values.regionalName || values.regionalId },
                        { label: 'Destacamentos', value: values.sectionalDestCount },
                        { label: 'Miembros', value: values.sectionalXDestMemberCount },
                      ],
                    },
                    // El admin de destacamento solo puede descargar la informacion General.
                    ...(canEdit
                      ? [
                          {
                            value: 'destacamentos',
                            label: 'Destacamentos',
                            rows: [{ label: 'Cantidad', value: values.sectionalDestCount }],
                          },
                          {
                            value: 'miembros',
                            label: 'Miembros',
                            rows: [{ label: 'Cantidad', value: values.sectionalXDestMemberCount }],
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
              <SectionalGeneralSection
                methods={methods}
                watch={watch}
                isCreateView={!currentSectional}
                disabled={!canEdit}
                lockedRegional={ownRegional}
              />
            </Box>

            {canEdit && (
              <Stack sx={{ mt: 3, alignItems: 'flex-end' }}>
                <Button type="submit" variant="contained" loading={isSubmitting}>
                  {!currentSectional ? 'Crear seccional' : 'Guardar cambios'}
                </Button>
              </Stack>
            )}
          </Card>
        </Grid>
      </Grid>
    </Form>
  );
}
