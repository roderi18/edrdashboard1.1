import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, Controller } from 'react-hook-form';
import { isValidPhoneNumber } from 'react-phone-number-input/input';

import { getDests } from 'src/services/dest-service';
import { getSectionals } from 'src/services/sectional-service';
import { getRegionals } from 'src/services/regional-service';
import { LEADERSHIP_ASSIGNMENTS } from 'src/_mock/leadershipAssignments';
import { resolveById } from 'src/utils/resolve-display-name';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from '@mui/material/TextField';
import { useEffect, useState } from 'react';
import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { ContextInfo } from 'src/components/info/context-info';
import { saveDest } from 'src/services/dest-service';
import { fData } from 'src/utils/format-number';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Form, Field, schemaUtils } from 'src/components/hook-form';
import { countMembersByDestId } from 'src/utils/member-count';

// ----------------------------------------------------------------------

export const DestCreateSchema = z.object({
  avatarUrl: schemaUtils.file({ error: 'Avatar is required!' }),

  name: z.string().min(1, { error: 'Destacamento requerido' }),
  churchName: z.string().min(1, { error: 'Nombre de iglesia requerido' }),
  coordinatorName: z.string().optional(),
  assistantCoordinatorName: z.string().optional(),

  address: z.string().min(1, { error: 'Dirección requerida' }),
  destMeetingTimes: z.string().optional(),

  shepardName: z.string().optional(),
  churchPhone: schemaUtils.phoneNumber({ isValid: isValidPhoneNumber }).optional(),

  destProvince: z.string().optional(),
  regionalName: z.string().optional(),
  // sectionalName: z.string().optional(),

  coordinatorId: z.string().nullable().optional(),
  sectionalId: z.string().nullable().optional(),

  status: z.string(),
  isVerified: z.boolean(),
});

// ----------------------------------------------------------------------

const mapDestToForm = (dest) => {
  console.log(
    LEADERSHIP_ASSIGNMENTS.filter(a => a.entityId === dest.id)
  );
  const sectional = sectionals.find((s) => s.id === dest.sectionalId);

  const coordinatorAssignment = LEADERSHIP_ASSIGNMENTS.find(
    (a) =>
      a.level === 'dest' &&
      a.entityId === dest.id &&
      a.role === 'coordinador_dest'
    // &&
    // a.status === 'active'
  );

  const assistantAssignment = LEADERSHIP_ASSIGNMENTS.find(
    (a) =>
      a.level === 'dest' &&
      a.entityId === dest.id &&
      a.role === 'coordinador_asist_dest'
    // &&
    // a.status === 'active'
  );

  const coordinator = getMembers().find(
    (m) => m.id === coordinatorAssignment?.memberId
  );

  const assistant = MEMBERS.find(
    (m) => m.id === assistantAssignment?.memberId
  );

  const generateChurchId = (name) => {
    return (
      'iglesia-' +
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
    );
  };

  const regional = sectional
    ? regionals.find((r) => r.id === sectional.regionalId)
    : null;

  return {
    avatarUrl: dest.avatarUrl ?? null,

    name: dest.name ?? '',
    churchId: dest.churchId
      ? churches.find((c) => c.id === dest.churchId) || null
      : null,
    address: dest.churchAddress ?? '',
    sectionalId: dest.sectionalId
      ? sectionals.find((s) => s.id === dest.sectionalId) || null
      : null,

    status: dest.membershipStatus ?? 'active',
    isVerified: dest.isVerified ?? true,

    coordinatorName: coordinator?.fullName ?? '',
    assistantCoordinatorName: assistant?.fullName ?? '',

    destMeetingTimes: dest.destMeetingTimes ?? '',
    shepardName: dest.shepardName ?? '',
    churchPhone: dest.churchPhone
      ? `+1${dest.churchPhone.replace(/\D/g, '')}`
      : '',
    destProvince: dest.destProvince ?? '',
    regionalName: regional?.name ?? '',
  };
};

// ----------------------------------------------------------------------

export function DestCreateEditForm({ currentDest }) {
  const router = useRouter();
  const [dests, setDests] = useState([]);
  const [sectionals, setSectionals] = useState([]);
  const [regionals, setRegionals] = useState([]);
  const [churches, setChurches] = useState([]);
  const allMembers = getMembers();
  const membersCount = countMembersByDestId(allMembers, currentDest?.id);

  const defaultValues = {
    avatarUrl: null,
    isVerified: true,
    status: 'active',
    country: 'Dominican Republic',

    name: '',
    churchName: '',

    coordinatorId: null,
    sectionalId: null,

    address: '',
    destMeetingTimes: '',
    shepardName: '',
    churchPhone: '',
    destProvince: '',
    regionalName: '',

  };

  const methods = useForm({
    mode: 'onSubmit',
    resolver: zodResolver(DestCreateSchema),
    defaultValues,
  });

  useEffect(() => {
    if (currentDest) {

      methods.reset(mapDestToForm(currentDest));
    }
  }, [currentDest]);

  useEffect(() => {

    setDests(getDests() || []);
    setSectionals(getSectionals() || []);
    setRegionals(getRegionals() || []);
    setChurches(getChurches() || []);

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

  const selectedRegional = regionals.find(
    (r) => r.id === selectedSectional?.regionalId
  );
  const sectional = sectionals.find((s) => s.id === selectedSectional?.id);
  const regional = regionals.find((r) => r.id === sectional?.regionalId);
  useEffect(() => {
    if (regional?.name) {
      methods.setValue('regionalName', regional.name);
    } else {
      methods.setValue('regionalName', '');
    }
  }, [selectedSectional, regional, methods]);

  const onSubmit = handleSubmit(async (data) => {

    console.log("FORM DATA:", data);
    console.log("COORDINATOR ID:", data.coordinatorId);
    console.log("SECTIONAL ID:", data.sectionalId);

    const destId = currentDest?.id || crypto.randomUUID();

    try {
      console.log("DEST A GUARDAR:", {
        coordinatorId: data.coordinatorId,
        sectionalId: data.sectionalId
      });
      saveDest({
        id: destId,

        name: data.name,
        destNumber: data.destNumber,

        coordinatorId: data.coordinatorId ?? null,

        churchName: data.churchName,
        churchId: data.church?.id ?? null,

        churchAddress: data.address,

        sectionalId: data.sectionalId ?? null,

        regionalId: regionals.find(
          (r) => r.name === data.regionalName
        )?.id ?? null,

        avatarUrl: data.avatarUrl,

        shepardName: data.shepardName,
        churchPhone: data.churchPhone,
        destProvince: data.destProvince,
        destMeetingTimes: data.destMeetingTimes,

        membershipStatus: data.status ?? 'active',
        isVerified: data.isVerified ?? true,
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      reset();

      toast.success(currentDest ? 'Actualización exitosa!' : 'Destacamento creado');

      router.push(paths.dashboard.level.dest.root);
      router.refresh();

    } catch (error) {
      console.error(error);
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
              <Field.Text name="name" label="Nombre de Destacamento" />
              <Field.Text
                name="destNumber"
                label="Número de Destacamento (al validar max 3) y no repetir"
                inputProps={{
                  inputMode: 'numeric',
                  pattern: '[0-9]*'
                }}
              />
              <Field.Autocomplete
                name="coordinatorId"
                label="Coordinador de Destacamento"
                options={[...MEMBERS, ...getMembers()]}
                value={
                  [...MEMBERS, ...getMembers()].find(
                    (m) => m.id === watch('coordinatorId')
                  ) || null
                }
                getOptionLabel={(option) =>
                  option?.fullName || `${option?.firstName || ''} ${option?.lastName || ''}`
                }
                isOptionEqualToValue={(option, value) => option.id === value.id}
                onChange={(_, value) =>
                  methods.setValue('coordinatorId', value?.id ?? null)
                }
              />
              {/* {currentDest && (
                <Field.Text name="assistantCoordinatorName" label="Coordinador Asist. de Destacamento" />
              )} */}
              <Field.CountrySelect
                fullWidth
                name="country"
                label="País"
                placeholder="Elige un país"
              />
              <Field.Text
                name="churchName"
                label="Nombre de la Iglesia"
              />

              <Field.Text name="address" label="Dirección iglesia" />
              <Field.Text name="shepardName" label="Pastor" />
              <Field.Phone name="churchPhone" label="Número teléfono pastor" defaultCountry="DO" />

              <Field.Text name="destMeetingTimes" label="Horarios reunión" />



              <Field.Text name="destProvince" label="Provincia" />
              <Field.Autocomplete
                name="sectionalId"
                label="Sección"
                options={SECTIONALS}
                value={
                  sectionals.find(
                    (s) => s.id === watch('sectionalId')
                  ) || null
                }
                getOptionLabel={(option) => option?.name || ''}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                onChange={(_, value) =>
                  methods.setValue('sectionalId', value?.id ?? null)
                }
              />
              {currentDest && (
                <Field.Text
                  name="regionalName"
                  label="Región"
                  disabled
                />
              )}


              {currentDest && (
                <TextField
                  label="Cantidad de miembros"
                  value={membersCount}
                  fullWidth
                  disabled
                />
              )}
            </Box>

            <Stack sx={{ mt: 3, alignItems: 'flex-end' }}>
              <Button type="submit" variant="contained" loading={isSubmitting}>
                {!currentDest ? 'Crear Destacamento' : 'Guardar cambios'}
              </Button>
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </Form>
  );
}
