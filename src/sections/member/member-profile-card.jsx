import dayjs from 'dayjs';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { ChipEstatusMiembro } from 'src/components/label';
import { ContextInfo } from 'src/components/info/context-info';
import { BotonCopiar } from 'src/components/common/boton-copiar';
import { UnderlineLink } from 'src/components/link/underline-link';
import { FotoDeMiembro } from 'src/components/upload/foto-de-miembro';
import {
  PinesDeMiembro,
  CintasDeMiembro,
  MedallasDeMiembro,
} from 'src/components/insignias-perfil';

import { MemberInfoPdfMenu } from './member-info-pdf-menu';

export function MemberProfileCard({
  avatarUrl,
  memberFullName,
  uploadingPhoto,
  canUploadMemberPhoto,
  onUploadPhoto,
  photoUploadErrorMessage,
  isCreateView,
  currentMember,
  memberDataNotice,
  selectedDest,
  destChurch,
  selectedSectional,
  selectedRegional,
  memberDestText,
  destLeadership,
  destName,
  destId,
  leadershipTexts,
  puedeDescargarInformacion,
  getValues,
  maskSensitive,
  maskAddress,
  maskContact,
  maskBirthdate,
  puedeRestablecerClave,
  codigoPendiente,
  codigoUnUso,
  generandoCodigo,
  onGenerateResetCode,
  horasCodigo,
  tiempoCodigoRestante,
  resetCodeLifetimeMs,
}) {
  return (
    <Card sx={{ pt: 5, pb: 5, px: 3, position: 'relative' }}>
      {!isCreateView && (
        <ChipEstatusMiembro estatus={currentMember?.status ?? currentMember?.estatusMiembro} />
      )}

      <Box sx={{ mb: 5 }}>
        <FotoDeMiembro
          url={avatarUrl?.preview || avatarUrl || ''}
          nombre={memberFullName}
          cargando={uploadingPhoto}
          puedeEditar={canUploadMemberPhoto}
          onFoto={(archivo) => onUploadPhoto([archivo])}
          ayuda={
            <>
              {!!photoUploadErrorMessage && (
                <Typography
                  variant="caption"
                  sx={{
                    mt: 1,
                    mx: 'auto',
                    display: 'block',
                    textAlign: 'center',
                    color: 'error.main',
                    fontWeight: 700,
                  }}
                >
                  {photoUploadErrorMessage}
                </Typography>
              )}

              <ContextInfo
                items={[
                  {
                    show: isCreateView && !!memberFullName,
                    text: memberFullName,
                    variant: 'subtitle1',
                    bold: true,
                    mt: 1,
                    color: 'text.primary',
                  },
                  {
                    show: !isCreateView && !!currentMember?.memberId,
                    text: `Miembro ${currentMember?.memberId}`,
                    copiar: currentMember?.memberId,
                    // Separado de la foto: pegado al boton de la camara se leia
                    // como parte de ella.
                    mt: 2,
                    aviso: memberDataNotice,
                  },
                  {
                    show: isCreateView && !!selectedDest?.name,
                    text: `pertenecer? a ${`${selectedDest?.name || ''} ${selectedDest?.destNumber || ''}`.trim()}`,
                  },
                  {
                    show: isCreateView && !!destChurch?.name,
                    text: destChurch?.name,
                  },
                  {
                    show: isCreateView && !!selectedSectional?.name,
                    text: `Secci?n ${selectedSectional?.name}`,
                  },
                  {
                    show: isCreateView && !!selectedRegional?.name,
                    text: selectedRegional?.name,
                  },
                ]}
              />

              {/* Debajo del codigo y para TODOS: antes se ocultaba a quien tenia cargo en
                  su destacamento, y la ficha no decia de donde era. */}
              {memberDestText && (
                <Typography
                  variant="body2"
                  sx={{ mt: 0, mx: 'auto', display: 'block', textAlign: 'center' }}
                >
                  {memberDestText.includes(destName) ? (
                    <>
                      {memberDestText.replace(destName, '')}
                      <UnderlineLink
                        href={`/dashboard/level/dest/${destId}/edit`}
                        sx={{ color: 'text.primary' }}
                      >
                        {destName}
                      </UnderlineLink>
                    </>
                  ) : (
                    memberDestText
                  )}
                </Typography>
              )}

              {!isCreateView && (
                <>
                  {/* Los pines van ENCIMA de las cintas, centrados. */}
                  <PinesDeMiembro
                    idMiembros={currentMember?.idMiembros ?? currentMember?.id}
                    sx={{ mt: 2 }}
                  />
                  <CintasDeMiembro
                    idMiembros={currentMember?.idMiembros ?? currentMember?.id}
                    sx={{ mt: 2 }}
                  />
                  <MedallasDeMiembro idMiembros={currentMember?.idMiembros ?? currentMember?.id} />
                </>
              )}

              {!isCreateView &&
                leadershipTexts.map((text, index) => (
                  <Typography
                    key={`${text}-${index}`}
                    variant="body2"
                    sx={{
                      mt: index === 0 ? 0.5 : 0.3,
                      mx: 'auto',
                      display: 'block',
                      textAlign: 'center',
                    }}
                  >
                    {text}
                  </Typography>
                ))}
            </>
          }
        />
      </Box>

      {currentMember && puedeDescargarInformacion && (
        <Stack
          spacing={1.5}
          sx={{ mt: 3, width: 1, maxWidth: 260, mx: 'auto', alignItems: 'stretch' }}
        >
          <MemberInfoPdfMenu
            obtenerValores={getValues}
            memberCode={currentMember?.memberId}
            fullName={memberFullName}
            destName={destName}
            avatarUrl={currentMember?.avatarUrl}
            masked={maskSensitive}
            maskAddress={maskAddress}
            maskContact={maskContact}
            maskBirthdate={maskBirthdate}
          />

          {puedeRestablecerClave && !!codigoPendiente && !codigoUnUso && (
            <Alert severity="warning" icon={false} sx={{ textAlign: 'left' }}>
              <Typography variant="body2">
                Ya hay un código activo
                {codigoPendiente.generadoPorMi
                  ? ' que generaste tú'
                  : codigoPendiente.generadoPorNombre
                    ? ` generado por ${codigoPendiente.generadoPorNombre}`
                    : ''}
                .{' '}
                {codigoPendiente.expiraEn
                  ? `Vence el ${dayjs(codigoPendiente.expiraEn).format('D [de] MMMM [a las] h:mm A')}.`
                  : ''}{' '}
                Si generas otro, el suyo dejará de servir.
              </Typography>

              <Button
                size="small"
                color="inherit"
                sx={{ mt: 1 }}
                disabled={generandoCodigo}
                onClick={onGenerateResetCode}
              >
                {generandoCodigo ? 'Generando…' : 'Generar otro de todas formas'}
              </Button>
            </Alert>
          )}

          {puedeRestablecerClave && (!codigoPendiente || codigoUnUso) && (
            <Button
              variant="outlined"
              color="inherit"
              disabled={generandoCodigo}
              onClick={onGenerateResetCode}
            >
              {generandoCodigo ? 'Generando…' : 'Restablecer contraseña'}
            </Button>
          )}

          {!!codigoUnUso && (
            <Alert severity="success" sx={{ textAlign: 'left' }}>
              <Typography variant="body2">
                Código temporal para crear una nueva contraseña.
                {horasCodigo ? ` Vence en ${horasCodigo} horas.` : ''}
              </Typography>

              <Box sx={{ gap: 0.5, display: 'flex', alignItems: 'center' }}>
                <Typography
                  variant="h6"
                  sx={{ letterSpacing: 2, fontFamily: 'monospace', userSelect: 'all' }}
                >
                  {codigoUnUso}
                </Typography>

                <BotonCopiar valor={codigoUnUso} titulo="Copiar código" />
              </Box>

              <LinearProgress
                color="success"
                variant="determinate"
                value={(tiempoCodigoRestante / resetCodeLifetimeMs) * 100}
                sx={{ mt: 1 }}
              />
            </Alert>
          )}
        </Stack>
      )}
    </Card>
  );
}
