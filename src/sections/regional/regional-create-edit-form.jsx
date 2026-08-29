import { usePathname } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';

import { useRouter } from 'src/routes/hooks';

import { contarRegion } from 'src/utils/org-counts';
import { canManageOrgLevels } from 'src/utils/admin-role-label';
import { esperar, RETARDO_GUARDADO_MS } from 'src/utils/ui-delays';
import { getImageOptimizationMessage } from 'src/utils/upload-optimization-message';
import { subirFotoEntidad, subirFotoEntidadPropuesta } from 'src/utils/firebase-photos';
import {
  canEditRegional,
  puedeSugerirFotoDeRegion,
  puedeAprobarCambiosDeOrganizacion,
} from 'src/utils/org-level-access';

import { AUTH } from 'src/lib/firebase';
import { getMembers } from 'src/services/member-service';
import { getChurches } from 'src/services/church-service';
import { RegionalSchema } from 'src/models/regional-schema';
import { getSectionals } from 'src/services/sectional-service';
import { saveRegional, updateRegional, proponerFotoRegion } from 'src/services/regional-service';
import {
  AMBITOS_CAMBIO,
  obtenerSolicitudesPendientesPorEntidad,
} from 'src/services/solicitudes-cambio-service';
import {
  guardarAsignacionDirectiva,
  obtenerAsignacionesDirectiva,
} from 'src/services/directivas-organizacionales-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Form, Field } from 'src/components/hook-form';
import { EntityInfoPdfMenu } from 'src/components/info/entity-info-pdf-menu';
import RegionalGeneralSection from 'src/components/form/regional-form/RegionalGeneralSection';

import { OrgPendingChangesDialog } from 'src/sections/common/org-pending-changes-dialog';

import { useAuthContext } from 'src/auth/hooks';
// ----------------------------------------------------------------------

// El director de una region NO es un campo de la tabla Regiones en la API: es una
// asignacion de directiva, igual que el coordinador de un destacamento. Por eso
// hay que guardarlo aparte; mandarlo dentro del payload no lo persistia en ningun
// sitio y el desplegable aparecia vacio al volver a entrar.
const CARGO_DIRECTOR_REGIONAL = 'regional-director-regional';

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
  // Editar: admin de region (su region) o global/funcional. Crear: solo
  // global/funcional. El resto navega y consulta en modo de solo lectura.
  const canEdit = currentRegional
    ? canEditRegional(user, currentRegional)
    : canManageOrgLevels(user);
  // Editar una region la aprueba la Oficina Nacional. Quien no puede aprobar no
  // esta guardando nada: esta enviando una propuesta, y el boton lo dice con las
  // mismas palabras que en secciones, destacamentos y miembros.
  const soloSugiereCambios = Boolean(currentRegional) && !puedeAprobarCambiosDeOrganizacion(user);
  const idRegionActual = String(currentRegional?.id ?? currentRegional?.idRegion ?? '');
  // LA FOTO NO ES LA FICHA. La region la edita la Oficina Nacional, pero la
  // imagen la puede PROPONER el Coordinador Regional y su Asistente: sugerir no
  // es cambiar. Mismo camino que en secciones y destacamentos.
  const puedeSugerirFoto =
    Boolean(currentRegional) && (canEdit || puedeSugerirFotoDeRegion(user, currentRegional));
  const soloSugiereFoto = puedeSugerirFoto && !puedeAprobarCambiosDeOrganizacion(user);
  const pathname = usePathname();
  const isEditView = pathname.includes('/edit');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState([]);
  const [pendientesAbierto, setPendientesAbierto] = useState(false);

  // Lo que ya se envio y sigue esperando. Se consulta al entrar y despues de
  // cada envio: sin esto, la pantalla muestra los datos de antes y no hay forma
  // de saber si el cambio se mando o se perdio.
  const cargarPendientes = useCallback(async () => {
    if (!idRegionActual) {
      setSolicitudesPendientes([]);
      return;
    }

    try {
      const pendientes = await obtenerSolicitudesPendientesPorEntidad({
        tipo: 'region',
        id: idRegionActual,
        ambitos: [AMBITOS_CAMBIO.region, AMBITOS_CAMBIO.fotoRegion],
      });

      setSolicitudesPendientes(pendientes);
    } catch (error) {
      console.warn('[regional form] no se pudieron leer los cambios pendientes', error);
      setSolicitudesPendientes([]);
    }
  }, [idRegionActual]);

  useEffect(() => {
    cargarPendientes();
  }, [cargarPendientes]);

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
    setValue,
    getValues,
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

    if (!puedeSugerirFoto) {
      toast.error('No tienes permiso para cambiar la foto de esta región.');
      return null;
    }

    try {
      setUploadingPhoto(true);

      // Sugerencia: la imagen se sube a una carpeta aparte y la foto oficial se
      // queda como esta. Devolver la url nueva pintaria un cambio que todavia no
      // existe, asi que se conserva la de antes.
      if (soloSugiereFoto) {
        const propuesta = await subirFotoEntidadPropuesta({
          file,
          tipoEntidad: 'region',
          idEntidad: regionalId,
          subidoPor: AUTH.currentUser?.uid || '',
        });

        await proponerFotoRegion({
          region: { id: regionalId, nombre: currentRegional?.name || '' },
          foto: propuesta,
          urlAntes: values.avatarUrl || currentRegional?.avatarUrl || '',
          usuario: user,
        });

        toast.info('Foto enviada a la Oficina Nacional. Se aplicará cuando la aprueben.');

        await cargarPendientes();

        return values.avatarUrl || currentRegional?.avatarUrl || null;
      }

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

  // Secciones, destacamentos y miembros de la region. La API devuelve estos tres
  // campos vacios, asi que la ficha mostraba 0. Se cuentan recorriendo la cadena
  // region -> secciones -> iglesias -> destacamentos -> miembros.
  useEffect(() => {
    let cancelado = false;

    const contar = async () => {
      const idRegion = currentRegional?.regionId ?? currentRegional?.id;

      if (!idRegion) return;

      const [sectionals, churches, members] = await Promise.all([
        getSectionals({ includePhotos: false }).catch(() => []),
        getChurches().catch(() => []),
        getMembers().catch(() => []),
      ]);

      let dests = [];

      try {
        const res = await fetch('/api/dest');
        const json = await res.json();
        dests = Array.isArray(json?.data) ? json.data : (json?.Data ?? []);
      } catch {
        dests = [];
      }

      if (cancelado) return;

      const totales = contarRegion({ idRegion, sectionals, churches, dests, members });

      methods.setValue('regionalXSectionalCount', totales.secciones);
      methods.setValue('regionalXSectionalXDestCount', totales.destacamentos);
      methods.setValue('regionalXSectionalMemberCount', totales.miembros);
    };

    contar();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRegional]);

  // La asignacion pasa por la puerta unica de cambios, asi que queda en el
  // historial y, si quien edita no puede aplicar directo, va a la Oficina Nacional.
  const guardarDirectorRegional = async ({ idRegion, nombreRegion, idMiembro }) => {
    if (!idMiembro) return;

    await guardarAsignacionDirectiva({
      nivel: 'regional',
      idEntidad: idRegion,
      nombreEntidad: nombreRegion || '',
      idCargo: CARGO_DIRECTOR_REGIONAL,
      idPosicionDirectiva: CARGO_DIRECTOR_REGIONAL,
      idMiembro,
      usuario: user,
    });
  };

  // El director no viene en la ficha que devuelve la API: se lee de las
  // asignaciones para que el desplegable aparezca relleno al abrir la region.
  useEffect(() => {
    let cancelado = false;

    const cargarDirector = async () => {
      if (!currentRegional?.id) return;

      const asignaciones = await obtenerAsignacionesDirectiva({
        nivel: 'regional',
        idEntidad: Number(currentRegional.id),
      }).catch(() => []);

      if (cancelado) return;

      const director = asignaciones.find(
        (asignacion) =>
          String(asignacion.idPosicionDirectiva || asignacion.idCargo || '') ===
          CARGO_DIRECTOR_REGIONAL
      );

      if (director?.idMiembro) {
        setValue('directorId', String(director.idMiembro));
      }
    };

    cargarDirector();

    return () => {
      cancelado = true;
    };
  }, [currentRegional?.id, setValue]);

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

      // Espera de cortesia, en paralelo con el guardado. Arranca DESPUES de las
      // validaciones para que un error salga al instante. Ver `ui-delays`.
      const espera = esperar(RETARDO_GUARDADO_MS);

      let resultado = null;

      if (currentRegional) {
        resultado = await updateRegional(payload, { usuario: user, antes: currentRegional });
      } else {
        resultado = await saveRegional(payload, { usuario: user });
      }

      await espera;

      if (resultado?.pendienteDeAprobacion) {
        // Todavia no se ha guardado nada: el cambio espera a la Oficina Nacional.
        toast.info('Cambios enviados a la Oficina Nacional. Se aplicarán cuando los apruebe.');
      } else {
        toast.success(
          currentRegional
            ? 'Actualizado correctamente!'
            : 'Región creada exitosamente!'
        );
      }

      const idRegion =
        currentRegional?.id ||
        resultado?.data?.idRegion ||
        resultado?.idRegion ||
        null;

      if (idRegion) {
        // La region ya quedo guardada: si el director choca con otro consejo, se
        // dice POR QUE en vez de dejar caer un "error al guardar la region" que
        // ademas seria falso.
        try {
          await guardarDirectorRegional({ idRegion, nombreRegion: data.name, idMiembro: getValues('directorId') });
        } catch (error) {
          console.error('[region] no se pudo asignar el director', error);
          toast.error(error?.message || 'No se pudo asignar el director regional.');
        }
      }

      if (currentRegional) {
        await cargarPendientes();
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
                disabled={uploadingPhoto}
                readOnly={!puedeSugerirFoto}
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
                    {/* A quien solo puede sugerirla, decirle los formatos no le
                        aclara lo que necesita saber: que la foto no cambia hasta
                        que la aprueben. */}
                    {soloSugiereFoto ? (
                      'La foto que subas se enviará a la Oficina Nacional para su aprobación. La actual se mantiene hasta que la aprueben.'
                    ) : (
                      <>
                        Permitido *.jpeg, *.jpg, *.png, *.gif
                        <br /> la imagen se optimiza al cargar.
                      </>
                    )}
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

            {(canEdit || solicitudesPendientes.length > 0) && (
              <Stack
                direction="row"
                spacing={2}
                sx={{ mt: 3, justifyContent: 'flex-end', flexWrap: 'wrap' }}
              >
                {solicitudesPendientes.length > 0 && (
                  <Button
                    type="button"
                    color="warning"
                    variant="outlined"
                    startIcon={<Iconify icon="solar:clock-circle-bold" />}
                    onClick={() => setPendientesAbierto(true)}
                  >
                    Ver cambios pendientes
                  </Button>
                )}

                {canEdit && (
                  <Button type="submit" variant="contained" loading={isSubmitting}>
                    {/* Lo que hace el boton, no lo que uno querria que hiciera:
                        el cambio no se aplica hasta que la Oficina Nacional lo
                        apruebe. */}
                    {!currentRegional
                      ? 'Crear Región'
                      : soloSugiereCambios
                        ? 'Enviar a aprobación'
                        : 'Guardar cambios'}
                  </Button>
                )}
              </Stack>
            )}
          </Card>
        </Grid>
      </Grid>

      <OrgPendingChangesDialog
        open={pendientesAbierto}
        solicitudes={solicitudesPendientes}
        entidad={values.name || currentRegional?.name || 'Región'}
        onClose={() => setPendientesAbierto(false)}
      />
    </Form>
  );
}
