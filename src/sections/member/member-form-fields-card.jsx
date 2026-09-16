import dayjs from 'dayjs';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { _leadershipRolesByLevel } from 'src/_mock/_leadership';
import { NATIONAL_LEADERSHIP_LEVELS } from 'src/catalogs/directiva-positions';

import { Iconify } from 'src/components/iconify';
import { Field } from 'src/components/hook-form';
import MemberGeneralSection from 'src/components/form/member-form/MemberGeneralSection';
import MemberAddressSection from 'src/components/form/member-form/MemberAddressSection';
import MemberInstructorCISection from 'src/components/form/member-form/MemberInstructorCISection';
import MemberLeadershipAndOtherSection from 'src/components/form/member-form/MemberLeadershipAndOtherSection';

export function MemberFormFieldsCard({
  age,
  division,
  isCreateView,
  step,
  control,
  minBirthdate,
  maxBirthdate,
  maskContact,
  maskBirthdate,
  maskAddress,
  readOnlyEffective,
  currentMember,
  isMobile,
  showMore,
  onToggleShowMore,
  watch,
  methods,
  dests,
  lockGroupLeaderFields,
  instructorCI,
  diasRestantesCI,
  isMinorForInstructorCI,
  destacamentoPropioFijo,
  onPreviousStep,
  onNextStep,
  isSubmitting,
  leaderPendingRequest,
  onShowPendingRequest,
  sendingApproval,
  isDirty,
  onRequestApproval,
  changeRequest,
  changeRequestOpen,
  onOpenChangeRequest,
  formErrorMessage,
}) {
  return (
    <Card sx={{ p: 3 }}>
      <Box
        sx={{
          rowGap: 3,
          columnGap: 2,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(1, 1fr)', sm: 'repeat(2, 1fr)' },
        }}
      >
        {(!isCreateView || step === 1) && (
          <MemberGeneralSection
            age={age}
            division={division}
            isCreateView={isCreateView}
            control={control}
            minBirthdate={minBirthdate}
            maxBirthdate={maxBirthdate}
            masked={maskContact}
            maskBirthdate={maskBirthdate}
            readOnly={readOnlyEffective}
            memberId={currentMember?.id}
          />
        )}

        {!isCreateView && (!isMobile || showMore) && (
          <>
            <MemberAddressSection isEdit readOnly={readOnlyEffective} masked={maskAddress} />

            {isCreateView && (
              <>
                <Field.Select
                  name="nationalLeadershipLevel"
                  label="Posici?n en Consejo Nacional"
                  value={watch('nationalLeadershipLevel') ?? ''}
                >
                  {NATIONAL_LEADERSHIP_LEVELS.map((option) => (
                    <MenuItem key={option.label} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Field.Select>

                {watch('nationalLeadershipLevel') !== 'none' && (
                  <Field.Select name="nationalLeadershipRole" label="Cargo">
                    {_leadershipRolesByLevel[watch('nationalLeadershipLevel')]?.map((role) => (
                      <MenuItem key={role.value} value={role.value}>
                        {role.label}
                      </MenuItem>
                    ))}
                  </Field.Select>
                )}
              </>
            )}

            <MemberLeadershipAndOtherSection
              watch={watch}
              methods={methods}
              isCreateView={false}
              isEdit
              dests={dests}
              lockCoreFields={lockGroupLeaderFields}
              readOnly={readOnlyEffective}
            />

            {!lockGroupLeaderFields && !isMinorForInstructorCI && (
              <MemberInstructorCISection
                instructorCI={instructorCI}
                diasRestantesCI={diasRestantesCI}
                isEdit
                disabled={readOnlyEffective}
              />
            )}
          </>
        )}

        {isCreateView && step === 1 && (
          <>
            <SectionDivider label="Direcci?n" />
            <MemberAddressSection />
          </>
        )}

        {isCreateView && step === 2 && (
          <>
            <SectionDivider label="Destacamento, liderazgo, otros" spaced />

            <MemberLeadershipAndOtherSection
              watch={watch}
              methods={methods}
              isCreateView
              dests={dests}
              lockCoreFields={lockGroupLeaderFields}
              lockDest={Boolean(destacamentoPropioFijo)}
            />

            {!lockGroupLeaderFields && !isMinorForInstructorCI && (
              <>
                <SectionDivider label="Instructor CI" spaced />

                <Field.Select name="InstructorCertificadoCI" label="?Instructor Certificado?">
                  <MenuItem value={1}>S?</MenuItem>
                  <MenuItem value={0}>No</MenuItem>
                </Field.Select>

                {instructorCI === 1 && (
                  <>
                    <Field.Select
                      name="EstatusVigenciaCI"
                      label="Estatus vigencia CI"
                      defaultValue="na"
                      sx={{ '& .MuiSelect-icon': { display: 'none' } }}
                      disabled
                    >
                      <MenuItem value={1}>Activo</MenuItem>
                      <MenuItem value={0}>Inactivo</MenuItem>
                      <MenuItem value="na">N/A</MenuItem>
                    </Field.Select>

                    <Field.DatePicker
                      name="FechaInicioCI"
                      label="Fecha inicio CI"
                      format="DD/MM/YYYY"
                      views={['year', 'month', 'day']}
                      minDate={dayjs().subtract(5, 'year').add(1, 'day')}
                      maxDate={dayjs()}
                    />
                    <Field.DatePicker
                      name="FechaVencimientoCI"
                      label={`Fecha vencimiento CI${
                        diasRestantesCI !== null && diasRestantesCI <= 365
                          ? ` (${diasRestantesCI >= 0 ? `${diasRestantesCI} d?as restantes` : `vencido hace ${Math.abs(diasRestantesCI)} d?as`})`
                          : ''
                      }`}
                      format="DD/MM/YYYY"
                      views={['year', 'month', 'day']}
                      disabled
                      sx={{ '& .MuiInputAdornment-root': { display: 'none' } }}
                    />
                  </>
                )}
              </>
            )}
          </>
        )}
      </Box>

      {!isCreateView && isMobile && (
        <Box sx={{ mt: 2 }}>
          <Button variant="text" fullWidth onClick={onToggleShowMore}>
            {showMore ? 'Ocultar información' : 'Ver más información'}
          </Button>
        </Box>
      )}

      {!readOnlyEffective && (
        <Stack direction="row" spacing={2} sx={{ mt: 3, justifyContent: 'flex-end' }}>
          {isCreateView && step === 2 && (
            <Button variant="outlined" onClick={onPreviousStep}>
              Atrás
            </Button>
          )}

          {isCreateView && step === 1 && (
            <Button variant="contained" onClick={onNextStep}>
              Siguiente (1 / 2)
            </Button>
          )}

          {isCreateView && step === 2 && (
            <Button type="submit" variant="contained" loading={isSubmitting}>
              Crear miembro
            </Button>
          )}

          {!isCreateView &&
            (lockGroupLeaderFields ? (
              leaderPendingRequest ? (
                <Button
                  type="button"
                  color="warning"
                  variant="outlined"
                  startIcon={<Iconify icon="solar:clock-circle-bold" />}
                  onClick={onShowPendingRequest}
                >
                  Ver cambios pendientes
                </Button>
              ) : (
                <LoadingButton
                  type="button"
                  variant="contained"
                  loading={sendingApproval}
                  disabled={!isDirty}
                  onClick={onRequestApproval}
                >
                  Enviar a aprobación
                </LoadingButton>
              )
            ) : (
              <>
                {changeRequest && !changeRequestOpen && (
                  <Button
                    type="button"
                    color="warning"
                    variant="outlined"
                    startIcon={<Iconify icon="solar:clock-circle-bold" />}
                    onClick={onOpenChangeRequest}
                  >
                    Cambios solicitados pendientes
                  </Button>
                )}
                <LoadingButton type="submit" variant="contained" loading={isSubmitting}>
                  Guardar cambios
                </LoadingButton>
              </>
            ))}
        </Stack>
      )}

      {!readOnlyEffective && formErrorMessage && (
        <Typography
          sx={{ mt: 1, typography: 'caption', color: 'error.main', textAlign: 'right' }}
        >
          Faltan campos obligatorios por completar
        </Typography>
      )}
    </Card>
  );
}

function SectionDivider({ label, spaced = false }) {
  return (
    <Box
      sx={{
        gridColumn: '1 / -1',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        ...(spaced && { my: 1 }),
      }}
    >
      <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />
      <Typography
        sx={{
          mx: 2,
          typography: 'subtitle2',
          color: 'text.secondary',
          ...(spaced && { whiteSpace: 'nowrap' }),
        }}
      >
        {label}
      </Typography>
      <Divider sx={{ flex: 1, borderStyle: 'dashed' }} />
    </Box>
  );
}
