import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { getSectionals } from 'src/services/sectional-service';
import { getRegionals } from 'src/services/regional-service';
import { getMembers } from 'src/services/member-service';
import { createChurchApi } from 'src/services/church-service';
import { ChurchSchema } from 'src/models/church-schema';
import { getChurches } from 'src/services/church-service';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import { useEffect, useState } from 'react';
import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { AUTH } from 'src/lib/firebase';
import { ContextInfo } from 'src/components/info/context-info';
import LoadingButton from '@mui/lab/LoadingButton';
import DashedAccordion from 'src/components/expandable/DashedAccordion';
import StatusLabel from 'src/components/common/status-label';
import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';
import { EntityInfoPdfMenu } from 'src/components/info/entity-info-pdf-menu';
import { countMembersByDestId } from 'src/utils/member-count';
import { getImageOptimizationMessage } from 'src/utils/upload-optimization-message';
import DestGeneralSection from 'src/components/form/dest-form/DestGeneralSection';
import { DestSchema } from 'src/models/dest-schema';
import ChurchDestSection from 'src/components/form/dest-form/ChurchDestSection';
import { mapApiDestToUI, saveDest } from 'src/services/dest-service';
import { subirFotoEntidad } from 'src/utils/firebase-photos';
import provinciasData from 'src/data/provincias.json';
import municipiosData from 'src/data/municipios.json';
import barriosData from 'src/data/barrios.json';

// import { ChurchSchema } from 'src/models/church-schema';
// import { saveChurch } from 'src/services/church-service';
// import { createChurch } from 'src/models/church-model';
// import { createChurchApi } from 'src/services/church-service';
import { createDestApi, getDestsApi, updateDestApi } from 'src/services/dest-service';
// ----------------------------------------------------------------------
const provinces = provinciasData;

const municipios = municipiosData.map((m, index) => ({
  ...m,
  id: index + 1,
  municipioId: index + 1,
}));

const sectores = barriosData;

const mapDestToForm = (dest, sectionals, regionals, churches, members) => {
  const church = churches.find((c) => String(c.id) === String(dest.churchId)) || {};
  const direccionParts = (church.address || '')
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);

  const [provinceName = '', municipioName = '', sectorName = '', street = ''] = direccionParts;
  const province = provinces.find(p => p.nombre?.trim() === provinceName);
  const municipio = municipios.find(m => m.nombre === municipioName);
  const sector = sectores.find(s => s.nombre === sectorName);

  return {
    avatarUrl: dest.avatarUrl ?? null,

    name: dest.name ?? '',
    destNumber: dest.destNumber ?? '',

    coordinatorId: dest.coordinatorId ?? null,

    registradoOfnc: dest.registradoOfnc ?? true,
    rritrackActivo: dest.rritrackActivo ?? false,

    correo:
      dest.correo && dest.correo.startsWith('nomail_')
        ? ''
        : dest.correo ?? '',
    telefono: dest.telefono ?? '',
    direccion: dest.direccion ?? '',
    concilio: dest.concilio ?? '',
    fechaInicio: dest.fechaInicio ?? '',

    country: dest.country ?? 'República Dominicana',

    churchId: dest.churchId ?? null,

    destMeetingDays: dest.destMeetingDays ?? '',
    destMeetingTimes: dest.destMeetingTimes ?? '',

    isVerified: dest.isVerified ?? true,

    churchName: church.name ?? '',
    pastor: church.pastor ?? '',
    address: church.address ?? '',
    provinceId: province?.id ? String(province.id) : '',
    municipioId: municipio?.id ? String(municipio.id) : '',
    sectorId: sector?.id ? String(sector.id) : '',
    street: street ?? '',
    countryId: church.countryId ?? '',

    sectionId: church.sectionId ?? '',
    sectionalName: church.sectionalName ?? '',
  };
};
// ----------------------------------------------------------------------

export function DestCreateEditForm({ currentDest }) {
  const isCreateView = !currentDest;
  const [step, setStep] = useState(isCreateView ? 1 : 2);
  const router = useRouter();
  const [dests, setDests] = useState([]);
  const [sectionals, setSectionals] = useState([]);
  const [regionals, setRegionals] = useState([]);
  const [churches, setChurches] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const membersCount = countMembersByDestId(allMembers, currentDest?.id);


  const defaultValues = {
    avatarUrl: null,

    name: '',
    destNumber: '',

    coordinatorId: null,
    churchId: null,

    country: '',

    destMeetingDays: '',
    destMeetingTimes: '',

    correo: '',
    telefono: '',

    registradoOfnc: true,
    rritrackActivo: false,

    // status: 'active',
    isVerified: true,

    churchName: '',
    pastor: '',
    address: '',
    provinceId: '',
    countryId: '',
    sectionId: '',
    sectionalName: '',

    fechaInicio: '',
    direccion: '',
    concilio: '',
    sectionId: '',
  };

  const CombinedSchema = step === 1 ? ChurchSchema : DestSchema;
  const methods = useForm({
    mode: 'onSubmit',
    resolver: zodResolver(CombinedSchema),
    defaultValues,
    shouldUnregister: false,
  });

  useEffect(() => {
    let isMounted = true;

    if (!currentDest) return;
    if (churches.length === 0) return;

    if (isMounted) {
      methods.reset(
        mapDestToForm(currentDest, sectionals, regionals, churches, allMembers)
      );
    }

    return () => {
      isMounted = false;
    };
  }, [currentDest, churches, sectionals, regionals, allMembers]);

  useEffect(() => {
    const loadData = async () => {
      const membersData = await getMembers();
      setAllMembers(Array.isArray(membersData) ? membersData : []);

      const res = await fetch('/api/dest');
      const data = await res.json();
      setDests(
        Array.isArray(data?.Data)
          ? data.Data.map(mapApiDestToUI)
          : []
      );

      const sectionalsData = await getSectionals();
      setSectionals(Array.isArray(sectionalsData) ? sectionalsData : []);

      const regionalsData = await getRegionals();
      setRegionals(Array.isArray(regionalsData) ? regionalsData : []);

      const churchesData = await getChurches();
      setChurches(Array.isArray(churchesData) ? churchesData : []);
    };

    loadData();
  }, []);

  const {
    reset,
    watch,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  const values = watch();
  const destName = watch('name');
  const destNumber = watch('destNumber');

  const selectedSectionId = watch('sectionId');

  const sectional = Array.isArray(sectionals)
    ? sectionals.find((s) => String(s.id) === String(selectedSectionId))
    : null;

  const regional = sectional
    ? regionals.find((r) => String(r.id) === String(sectional.regionalId))
    : null;

  const resolveDestId = async (destNameValue, destNumberValue) => {
    if (currentDest?.id) return currentDest.id;

    const destsData = await getDestsApi();
    const savedDest = destsData.find(
      (dest) =>
        String(dest?.name || '').trim().toLowerCase() === String(destNameValue || '').trim().toLowerCase() &&
        String(dest?.destNumber || '').trim() === String(destNumberValue || '').trim()
    );

    return savedDest?.id || null;
  };

  const handleUploadDestPhoto = async (acceptedFiles) => {
    const file = acceptedFiles?.[0];
    const destId = currentDest?.id;

    if (!currentDest || !destId) {
      toast.error('Primero guarda el destacamento antes de subir una foto.');
      return null;
    }

    try {
      setUploadingPhoto(true);

      const photo = await subirFotoEntidad({
        file,
        tipoEntidad: 'destacamento',
        idEntidad: destId,
        tipoFoto: 'perfil',
        subidoPor: AUTH.currentUser?.uid || '',
      });

      toast.success(getImageOptimizationMessage(file.__optimizationInfo));

      return photo.urlFoto;
    } catch (error) {
      console.error('[dest form] photo upload failed', error);
      toast.error(error.message || 'No se pudo subir la foto.');
      return null;
    } finally {
      setUploadingPhoto(false);
    }
  };


  const onSubmit = handleSubmit(async (data) => {
    try {

      const destPayloadData = {
        ...data,
        idDestacamento: currentDest?.id,
        idIglesia: Number(data.churchId) || 0,
        correo: data.correo ?? '',
        telefono: data.telefono ?? '',
        destMeetingDays: data.destMeetingDays ?? '',
        destMeetingTimes: data.destMeetingTimes ?? '',
        destNumber: data.destNumber ?? '',
        direccion: data.direccion ?? data.address ?? '',
        concilio: data.concilio ?? '',
        fechaInicio: data.fechaInicio || new Date().toISOString(),
      };

      if (currentDest) {
        await updateDestApi(destPayloadData);
      } else {
        await createDestApi(destPayloadData);
      }

      const resolvedDestId = await resolveDestId(data.name, data.destNumber);

      if (resolvedDestId) {
        saveDest({
          ...(currentDest || {}),
          ...destPayloadData,
          id: String(resolvedDestId),
          coordinatorId: data.coordinatorId ?? null,
          churchId: data.churchId ? String(data.churchId) : null,
          avatarUrl: data.avatarUrl ?? currentDest?.avatarUrl ?? null,
        });
      }

      toast.success(
        currentDest ? 'Actualización exitosa!' : 'Destacamento creado'
      );

      if (currentDest) {
        router.refresh();
        return;
      }

      reset();
      router.push(paths.dashboard.level.dest.root);
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error('Error creando destacamento');
    }
  });

  return (
    <Form methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ pt: 10, pb: 5, px: 3 }}>
            {/* {currentDest && (
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
            )} */}

            <Box sx={{ mb: 5 }}>
              <Field.UploadAvatar
                name="avatarUrl"
                loading={uploadingPhoto}
                disabled={uploadingPhoto}
                onDrop={handleUploadDestPhoto}
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

              {/* BADGE REGISTRADO en oficina*/}
              <Box
                sx={{
                  position: 'absolute',
                  top: 24,
                  right: 24,
                  display: 'flex',
                  gap: 1,
                }}
              >
                <StatusLabel
                  value={watch('registradoOfnc')}
                  activeText="Registrado"
                  inactiveText="sin registro oficial"
                  sx={{ position: 'static' }} // IMPORTANTE para dejar horizontalmente
                />

                <StatusLabel
                  value={watch('rritrackActivo')}
                  activeText="RRITrack activo"
                  inactiveText="RRITrack inactivo"
                  warningText="RRITrack vencido"
                  sx={{ position: 'static' }}
                />
              </Box>

            </Box>

            <Stack spacing={1} sx={{ mb: 3 }}>
              <FormControlLabel
                labelPlacement="start"
                control={
                  <Switch
                    checked={watch('registradoOfnc') ?? true}
                    onChange={(event) =>
                      methods.setValue('registradoOfnc', event.target.checked, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  />
                }
                label={
                  <>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      Registrado en Oficina Nacional
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Registrado oficialmente con número de Destacamento
                    </Typography>
                  </>
                }
                sx={{
                  mx: 0,
                  mb: 2,
                  width: 1,
                  justifyContent: 'space-between',
                }}
              />

              <FormControlLabel
                labelPlacement="start"
                control={
                  <Switch
                    checked={watch('rritrackActivo') ?? false}
                    onChange={(event) =>
                      methods.setValue('rritrackActivo', event.target.checked, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  />
                }
                label={
                  <>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      RRITrack activo
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      Destacamento cuenta con licencia anual de RRITrack
                    </Typography>
                  </>
                }
                sx={{
                  mx: 0,
                  mb: 2,
                  width: 1,
                  justifyContent: 'space-between',
                }}
              />
            </Stack>

            <ContextInfo
              items={[
                {
                  show: !currentDest && !!destName,
                  text: `Destacamento ${destName ?? ''} ${destNumber ?? ''}`.trim(),
                  variant: 'subtitle1',
                  bold: true,
                  mt: 1,
                  color: 'text.primary',
                },
                {
                  show: !currentDest && !!sectional?.sectionalName,
                  text: `pertenecerá a la Sección ${sectional?.sectionalName}`,
                },
                {
                  show: !currentDest && !!regional?.name,
                  text: `${regional?.name}`,
                },
              ]}
            />

            {/* {currentDest && (
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
            )} */}


            {currentDest && (
              <Stack sx={{ mt: 3, alignItems: 'center', justifyContent: 'center' }}>
                <EntityInfoPdfMenu
                  title={`${values.name || currentDest?.name || 'Destacamento'} ${values.destNumber || ''}`.trim()}
                  subtitle={`Destacamento ${currentDest?.id || currentDest?.idDestacamento || ''}`}
                  avatarUrl={values.avatarUrl}
                  fileName={`destacamento-${currentDest?.id || currentDest?.idDestacamento || 'info'}.pdf`}
                  sections={[
                    {
                      value: 'general',
                      label: 'General',
                      required: true,
                      rows: [
                        { label: 'Nombre', value: values.name },
                        { label: 'Número', value: values.destNumber },
                        { label: 'ID', value: currentDest?.id || currentDest?.idDestacamento },
                        { label: 'Sección', value: values.sectionName || values.sectionId },
                        { label: 'Iglesia', value: values.churchName || values.churchId },
                        { label: 'Miembros', value: values.memberCount },
                      ],
                    },
                    {
                      value: 'iglesia',
                      label: 'Iglesia',
                      rows: [{ label: 'Iglesia', value: values.churchName || values.churchId }],
                    },
                    {
                      value: 'miembros',
                      label: 'Miembros',
                      rows: [{ label: 'Cantidad', value: values.memberCount }],
                    },
                  ]}
                />
              </Stack>
            )}

            {currentDest && (
              <Stack sx={{ mt: 3, alignItems: 'center', justifyContent: 'center' }}>
                <Button variant="soft" color="error">
                  Delete dest
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
              {isCreateView ? (
                <>
                  {step === 1 && (
                    <Box sx={{ gridColumn: '1 / -1' }}>
                      <ChurchDestSection isCreateView />
                    </Box>
                  )}

                  {step === 2 && (
                    <DestGeneralSection
                      isCreateView
                      members={allMembers}
                      churches={churches}
                      methods={methods}
                      watch={watch}
                    />
                  )}
                </>
              ) : (
                <>
                  <DestGeneralSection
                    members={allMembers}
                    churches={churches}
                    methods={methods}
                    watch={watch}
                  />

                  <Box sx={{ gridColumn: '1 / -1' }}>
                    <DashedAccordion title="Información de la iglesia">
                      <ChurchDestSection />
                    </DashedAccordion>
                  </Box>
                </>
              )}
            </Box>

            <Stack direction="row" spacing={2} sx={{ mt: 3, justifyContent: 'flex-end' }}>
              {isCreateView ? (
                <>
                  {step > 1 && (
                    <Button variant="outlined" onClick={() => setStep(step - 1)}>
                      Atrás
                    </Button>
                  )}

                  {step === 1 && (
                    <LoadingButton
                      variant="contained"
                      loading={isSubmitting}
                      onClick={handleSubmit(async (data) => {
                        try {

                          const churchRes = await createChurchApi({
                            churchName: data.churchName,
                            pastor: data.pastor,
                            street: data.street,
                            provinceId: data.provinceId,
                            municipioId: data.municipioId,
                            sectorId: data.sectorId,
                            correo: methods.getValues('correo'),
                            sectionId: data.sectionId,
                          });

                          const churchesData = await getChurches();
                          setChurches(Array.isArray(churchesData) ? churchesData : []);

                          const churchId =
                            churchRes?.Data?.idIglesia ??
                            churchRes?.Data?.IdIglesia ??
                            churchRes?.idIglesia ??
                            churchRes?.IdIglesia;

                          if (!churchId) {
                            throw new Error('No se pudo obtener idIglesia');
                          }

                          // 🔥 guardar en el form
                          methods.setValue('churchId', String(churchId), {
                            shouldValidate: true,
                            shouldDirty: true,
                          });

                          // 🔥 pasar al step 2
                          setStep(2);
                        } catch (error) {
                          console.error(error);
                          toast.error('Error creando iglesia');
                        }
                      })}
                    >
                      Crear Iglesia
                    </LoadingButton>
                  )}

                  {step === 2 && (
                    <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                      Crear Destacamento
                    </LoadingButton>
                  )}
                </>
              ) : (
                <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                  Guardar cambios
                </LoadingButton>
              )}
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </Form>
  );
}
