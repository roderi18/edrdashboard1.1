import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';

import { getDests } from 'src/services/dest-service';
import { getSectionals } from 'src/services/sectional-service';
import { getRegionals } from 'src/services/regional-service';
import { getMembers } from 'src/services/member-service';
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
import { ContextInfo } from 'src/components/info/context-info';
import { saveDest } from 'src/services/dest-service';
import { fData } from 'src/utils/format-number';
import LoadingButton from '@mui/lab/LoadingButton';
import { createDest } from 'src/models/dest-model';
import DashedAccordion from 'src/components/expandable/DashedAccordion';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Form, Field } from 'src/components/hook-form';
import { countMembersByDestId } from 'src/utils/member-count';
import DestGeneralSection from 'src/components/form/dest-form/DestGeneralSection';
import { DestSchema } from 'src/models/dest-schema';
import ChurchDestSection from 'src/components/form/dest-form/ChurchDestSection';
import { ChurchSchema } from 'src/models/church-schema';
import { saveChurch } from 'src/services/church-service';
import { createChurch } from 'src/models/church-model';
import { createChurchApi } from 'src/services/church-service';
import { createDestApi } from 'src/services/dest-service';
// ----------------------------------------------------------------------

const mapDestToForm = (dest, sectionals, regionals, churches, members) => {
  const church = churches.find((c) => c.id === dest.churchId) || {};

  return {
    avatarUrl: dest.avatarUrl ?? null,

    name: dest.name ?? '',
    destNumber: dest.destNumber ?? '',

    coordinatorId: dest.coordinatorId ?? null,

    country: dest.country ?? 'República Dominicana',

    churchId: dest.churchId
      ? churches.find((c) => c.id === dest.churchId) || null
      : null,

    destMeetingDays: dest.destMeetingDays ?? '',
    destMeetingTimes: dest.destMeetingTimes ?? '',

    status: dest.membershipStatus ?? 'active',
    isVerified: dest.isVerified ?? true,

    churchName: church.name ?? '',
    pastor: church.pastor ?? '',
    address: church.address ?? '',
    provinceId: church.provinceId ?? '',
    countryId: church.countryId ?? '',
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
  const membersCount = countMembersByDestId(allMembers, currentDest?.id);


  const defaultValues = {
    avatarUrl: null,
    isVerified: true,
    status: 'active',

    name: '',
    destNumber: '',

    coordinatorId: null,

    country: 'República Dominicana',

    churchId: null,

    destMeetingTimes: '',


    churchName: '',
    pastor: '',
    address: '',
    provinceId: '',
    countryId: '',
    sectionalName: '',

  };

  const CombinedSchema = ChurchSchema.merge(DestSchema);
  const methods = useForm({
    mode: 'onSubmit',
    resolver: zodResolver(CombinedSchema),
    defaultValues,
  });
  useEffect(() => {
    if (!currentDest) return;

    if (churches.length === 0) return;

    methods.reset(
      mapDestToForm(currentDest, sectionals, regionals, churches, allMembers)
    );
  }, [currentDest, churches.length]);

  useEffect(() => {
    const loadData = async () => {
      const membersData = await getMembers();
      setAllMembers(Array.isArray(membersData) ? membersData : []);

      setDests(getDests() || []);

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

  const selectedSectional = watch('sectionalId');
  const selectedRegional = Array.isArray(regionals)
    ? regionals.find((r) => r.id === selectedSectional?.regionalId)
    : null;

  const sectional = Array.isArray(sectionals)
    ? sectionals.find((s) => s.id === selectedSectional?.id)
    : null;

  const regional = sectional
    ? regionals.find((r) => r.id === sectional.regionalId)
    : null;


  const onSubmit = handleSubmit(async (data) => {
    try {
      console.log('FORM DATA 👉', data);

      // 1. Crear iglesia (sin usar id)
      await createChurchApi(data);

      // 2. Crear destacamento (sin idIglesia)
      await createDestApi(data);

      reset();

      toast.success(
        currentDest ? 'Actualización exitosa!' : 'Destacamento creado'
      );

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
            {currentDest && (
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
                  show: !currentDest && !!sectional?.name,
                  text: `pertenecerá a la Sección ${sectional?.name}`,
                },
                {
                  show: !currentDest && !!regional?.name,
                  text: `${regional?.name}`,
                },
              ]}
            />

            {currentDest && (
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
                      onClick={handleSubmit(async () => {
                        setStep(2);
                      })}
                    >
                      Siguiente
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
