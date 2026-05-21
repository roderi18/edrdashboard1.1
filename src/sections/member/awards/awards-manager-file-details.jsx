import dayjs from 'dayjs';
import { useBoolean } from 'minimal-shared/hooks';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { getAwardsProgressCache } from 'src/services/awards-progress-cache';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { FileThumbnail } from 'src/components/file-thumbnail';

import { PdfViewerDialog } from 'src/sections/member/awards/components/viewer/PdfViewerDialog';
import { StatusSelectCell } from 'src/sections/member/awards/components/status/StatusSelectCell';
import { createAwardsActions } from 'src/sections/member/awards/components/core/AwardsActionsCore';

import { useAuthContext } from 'src/auth/hooks';

import { AwardsManagerShareDialog } from './awards-manager-share-dialog';
import { AwardsManagerInvitedItem } from './awards-manager-invited-item';

// ----------------------------------------------------------------------

export function FileManagerFileDetails({
  file,
  memberId,
  system,
  open,
  onClose,
  onDelete,
  favorited,
  onFavorite,
  onCopyLink,
  isGridView = false,
  ...other
}) {
  const { user } = useAuthContext();
  const shareDialog = useBoolean();
  const showTags = useBoolean(false); //desplegable cerrado por default
  const showDescription = useBoolean(true);
  const showAwardsStatus = useBoolean(true);

  const [inviteEmail, setInviteEmail] = useState('');
  const [tags, setTags] = useState(file?.tags?.slice(0, 3) || []);
  const [localStatus, setLocalStatus] = useState('no_iniciado');
  const [completedDate, setCompletedDate] = useState(null);
  const [timesCompleted, setTimesCompleted] = useState(0);
  const [certificateFile, setCertificateFile] = useState(null);
  const [hasCertificate, setHasCertificate] = useState(false);
  const fileInputId = `drawer-cert-upload-${file?.id}`;
  const pdfViewer = useBoolean();
  const confirmDelete = useBoolean();
  const confirmDeleteForStatus = useBoolean();
  const [pendingStatus, setPendingStatus] = useState(null);

  const resolvedMemberId = memberId || file?.memberId;
  const resolvedSystem = system;

  if (!resolvedSystem) {
    console.warn('[FileDetails] system no definido', {
      systemProp: system,
      file,
    });
  }

  const actions = createAwardsActions({
    system: resolvedSystem,
    memberId: resolvedMemberId,
    context:
      resolvedSystem === 'academia'
        ? { parentId: file?.parentId, rowId: file?.id }
        : {
            sectionId: file?.sectionId ?? file?.parentId?.split('-')[2], // 👈 fallback real
            parentId: file?.parentId,
            rowId: file?.id,
          },
    metadata: {
      nombreItemAscenso: file?.name,
      idGrupo: file?.parentId,
      nombreGrupo: file?.parentName || file?.parentId,
      idDivision: file?.sectionId || '',
    },
    user,
  });

  useEffect(() => {
    if (!resolvedMemberId || !file?.id) return undefined;

    const loadData = () => {
      const { status: storedStatus = {}, data: storedData = {} } =
        getAwardsProgressCache(resolvedMemberId);

      const rowStatus =
        resolvedSystem === 'academia'
          ? storedStatus?.academia?.[file.parentId]?.[file.id]
          : storedStatus?.sistemaAscenso?.[file.sectionId]?.[file.parentId]?.[file.id];

      const rowData =
        resolvedSystem === 'academia'
          ? storedData?.academia?.[file.parentId]?.[file.id]
          : storedData?.sistemaAscenso?.[file.sectionId]?.[file.parentId]?.[file.id];

      if (rowStatus) {
        setLocalStatus(rowStatus);
      }

      if (rowData?.completedDate) {
        setCompletedDate(dayjs(rowData.completedDate));
      } else {
        setCompletedDate(null);
      }

      // 🔥 Certificado (aplica para ambos sistemas)
      if (rowData?.certificate) {
        setCertificateFile(rowData.certificate);
        setHasCertificate(true);
      } else {
        setCertificateFile(null);
        setHasCertificate(false);
      }

      // 🔥 TimesCompleted solo para sistemaAscenso
      if (resolvedSystem === 'sistemaAscenso') {
        setTimesCompleted(rowData?.timesCompleted || 0);
      }
    };

    loadData();

    const handleChange = (event) => {
      if (event.detail?.memberId === resolvedMemberId) {
        loadData();
      }
    };

    window.addEventListener('awards-status-changed', handleChange);

    return () => {
      window.removeEventListener('awards-status-changed', handleChange);
    };
  }, [resolvedMemberId, file, resolvedSystem]);

  const hasShared = file?.shared && !!file?.shared.length;

  const handleChangeInvite = useCallback((event) => {
    setInviteEmail(event.target.value);
  }, []);

  const handleChangeTags = useCallback((newValue) => {
    setTags(newValue);
  }, []);

  const handleUploadCertificate = (event) => {
    const fileUploaded = event.target.files?.[0];
    if (!fileUploaded) return;

    const reader = new FileReader();
    reader.onload = () => {
      const certificate = {
        name: fileUploaded.name,
        type: fileUploaded.type,
        size: fileUploaded.size,
        fileBase64: reader.result,
      };

      actions.uploadCertificate(certificate);
    };

    reader.readAsDataURL(fileUploaded);
  };

  const renderHead = () => (
    <Box
      sx={{
        p: 2.5,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Typography variant="h6" sx={{ flexGrow: 1 }}>
        Información de premio
      </Typography>

      <Checkbox
        color="warning"
        icon={<Iconify icon="eva:star-outline" />}
        checkedIcon={<Iconify icon="eva:star-fill" />}
        checked={favorited}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onChange={(e) => {
          e.stopPropagation();
          onFavorite(file.id);
        }}
        slotProps={{
          input: {
            id: `favorite-details-${file.id}-checkbox`,
            'aria-label': `Favorite details ${file.id} checkbox`,
          },
        }}
      />
    </Box>
  );

  const renderDescription = () => {
    const fileDetails = [
      {
        label:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      },
    ];

    return (
      <Stack spacing={1.5}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            typography: 'subtitle2',
            justifyContent: 'space-between',
          }}
        >
          Descripción
          <IconButton size="small" onClick={showDescription.onToggle}>
            <Iconify
              icon={
                showDescription.value ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'
              }
            />
          </IconButton>
        </Box>

        {showDescription.value &&
          fileDetails.map((property) => (
            <Box
              key={property.label}
              sx={{ gap: 2, display: 'flex', typography: 'caption', textTransform: 'none' }}
            >
              <Box component="span" sx={{ width: 400, color: 'text.secondary' }}>
                {property.label}
              </Box>
              {property.value}
            </Box>
          ))}
      </Stack>
    );
  };

  ////////////////////
  const renderAwardsStatus = () => (
      <Stack spacing={1.5}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            typography: 'subtitle2',
            justifyContent: 'space-between',
          }}
        >
          Estado y certificación
          <IconButton size="small" onClick={showAwardsStatus.onToggle}>
            <Iconify
              icon={
                showAwardsStatus.value ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'
              }
            />
          </IconButton>
        </Box>

        {showAwardsStatus.value && (
          <Stack spacing={2}>
            {/* ESTADO */}
            <Box>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}
              >
                Estado
              </Typography>

              <StatusSelectCell
                value={localStatus}
                hasCertificate={hasCertificate}
                onChange={(next) => {
                  if (hasCertificate && localStatus === 'completado' && next !== 'completado') {
                    setPendingStatus(next);
                    confirmDeleteForStatus.onTrue();
                    return;
                  }

                  setLocalStatus(next);
                  actions?.setStatus(next);
                }}
                isAwardsManagerFileDetails
              />
            </Box>

            {/* COMPLETADO EN FECHA */}
            <Box>
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}
              >
                Completado en fecha
              </Typography>

              <DatePicker
                disabled={localStatus !== 'completado'}
                value={completedDate}
                onChange={(newValue) => {
                  setCompletedDate(newValue);
                  actions?.setCompletedDate(newValue?.toISOString());
                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small',
                  },
                }}
              />
            </Box>

            {/* N° DE VECES */}
            {resolvedSystem === 'sistemaAscenso' && (
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}
                >
                  N.° de veces
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={localStatus !== 'completado' || timesCompleted <= 0}
                    onClick={() => {
                      const next = timesCompleted - 1;
                      setTimesCompleted(next);
                      actions?.updateTimesCompleted(next);
                    }}
                  >
                    −
                  </Button>

                  <Box sx={{ minWidth: 32, textAlign: 'center', fontWeight: 600 }}>
                    {timesCompleted}
                  </Box>

                  <Button
                    variant="outlined"
                    size="small"
                    disabled={localStatus !== 'completado'}
                    onClick={() => {
                      const next = timesCompleted + 1;
                      setTimesCompleted(next);
                      actions?.updateTimesCompleted(next);
                    }}
                  >
                    +
                  </Button>
                </Box>
              </Box>
            )}
          </Stack>
        )}
      </Stack>
    );

  // const renderTags = () => (
  //   <Stack spacing={1.5}>
  //     <Box
  //       sx={{
  //         display: 'flex',
  //         alignItems: 'center',
  //         typography: 'subtitle2',
  //         justifyContent: 'space-between',
  //       }}
  //     >
  //       Tags
  //       <IconButton size="small" onClick={showTags.onToggle}>
  //         <Iconify
  //           icon={showTags.value ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'}
  //         />
  //       </IconButton>
  //     </Box>

  //     {showTags.value && (
  //       <Autocomplete
  //         multiple
  //         freeSolo
  //         options={file?.tags?.map((option) => option) || []}
  //         getOptionLabel={(option) => option}
  //         defaultValue={file?.tags?.slice(0, 3) || []}
  //         value={tags}
  //         onChange={(event, newValue) => {
  //           handleChangeTags(newValue);
  //         }}
  //         renderInput={(params) => <TextField {...params} placeholder="#Add a tags" />}
  //         slotProps={{
  //           chip: { size: 'small', variant: 'soft' },
  //         }}
  //       />
  //     )}
  //   </Stack>
  // );

  const renderShared = () => (
    <>
      <Box
        sx={{
          p: 2.5,
          display: 'flex',
          alignItems: 'center',
          typography: 'subtitle2',
          justifyContent: 'space-between',
        }}
      >
        Compartir con
        <IconButton
          size="small"
          color="primary"
          onClick={shareDialog.onTrue}
          sx={{
            width: 24,
            height: 24,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': { bgcolor: 'primary.dark' },
          }}
        >
          <Iconify width={16} icon="mingcute:add-line" />
        </IconButton>
      </Box>

      {hasShared && (
        <Box component="ul" sx={{ pl: 2, pr: 1 }}>
          {file?.shared?.map((person) => (
            <AwardsManagerInvitedItem key={person.id} person={person} />
          ))}
        </Box>
      )}
    </>
  );

  return (
    <>
      <Drawer
        aria-hidden={!open}
        open={open}
        onClose={onClose}
        anchor="right"
        slotProps={{
          backdrop: { invisible: true },
          paper: { sx: { width: 320 } },
        }}
        {...other}
      >
        <Scrollbar>
          {renderHead()}

          <Stack
            spacing={2.5}
            sx={{ p: 2.5, justifyContent: 'center', bgcolor: 'background.neutral' }}
          >
            <FileThumbnail
              showImage
              file={file?.type === 'folder' ? file?.type : file?.url}
              sx={{ width: 'auto', height: 'auto', alignSelf: 'flex-start' }}
              slotProps={{
                img: { sx: { width: 320, height: 'auto', aspectRatio: '4/3', objectFit: 'cover' } },
                icon: { sx: { width: 64, height: 64 } },
              }}
            />

            <Typography variant="subtitle1" sx={{ wordBreak: 'break-all' }}>
              {file?.name}
            </Typography>

            <Divider sx={{ borderStyle: 'dashed' }} />

            {/* {renderTags()} */}
            {renderDescription()}
            {renderAwardsStatus()}
          </Stack>

          {renderShared()}
        </Scrollbar>

        <Box sx={{ p: 2.5 }}>
          {localStatus === 'completado' && !hasCertificate && (
            <>
              <input
                id={fileInputId}
                type="file"
                hidden
                accept="application/pdf"
                onChange={handleUploadCertificate}
              />

              <Button
                fullWidth
                variant="contained"
                startIcon={<Iconify icon="eva:cloud-upload-fill" />}
                onClick={() => {
                  if (!completedDate) return;
                  document.getElementById(fileInputId)?.click();
                }}
              >
                Subir certificado
              </Button>
            </>
          )}

          {localStatus === 'completado' && hasCertificate && (
            <>
              <Button
                fullWidth
                variant="contained"
                startIcon={<Iconify icon="eva:eye-fill" />}
                onClick={pdfViewer.onTrue}
                sx={{ mb: 1 }}
              >
                Ver certificado
              </Button>

              <Button
                fullWidth
                variant="contained"
                startIcon={<Iconify icon="solar:download-bold" />}
                sx={{ mb: 1 }}
                onClick={() => {
                  const link = document.createElement('a');
                  link.href =
                    certificateFile.fileBase64 || certificateFile.urlPdf || certificateFile.pdfUrl;
                  link.download = certificateFile.name || 'certificado.pdf';
                  link.click();
                }}
              >
                Descargar certificado
              </Button>

              <Button
                fullWidth
                variant="soft"
                color="error"
                startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
                onClick={confirmDelete.onTrue}
              >
                Eliminar certificado
              </Button>
            </>
          )}
        </Box>
      </Drawer>
      <ConfirmDialog
        open={confirmDeleteForStatus.value}
        onClose={() => {
          confirmDeleteForStatus.onFalse();
          setPendingStatus(null);
        }}
        title="Eliminar certificado"
        content="Has cargado un certificado. Para cambiar el estado debes eliminarlo primero. ¿Deseas eliminarlo?"
        action={
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              actions.deleteCertificate();

              if (pendingStatus) {
                setLocalStatus(pendingStatus);
                actions.setStatus(pendingStatus);
              }

              setPendingStatus(null);
              confirmDeleteForStatus.onFalse();
            }}
          >
            Sí, eliminar
          </Button>
        }
      />
      <ConfirmDialog
        open={confirmDelete.value}
        onClose={confirmDelete.onFalse}
        title="Eliminar certificado"
        content="¿Deseas eliminar este certificado?"
        action={
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              actions.deleteCertificate();
              setCertificateFile(null);
              setHasCertificate(false);
              confirmDelete.onFalse();

              window.dispatchEvent(
                new CustomEvent('awards-status-changed', {
                  detail: { memberId: resolvedMemberId },
                })
              );
            }}
          >
            Sí, eliminar
          </Button>
        }
      />

      <PdfViewerDialog
        open={pdfViewer.value}
        onClose={pdfViewer.onFalse}
        fileBase64={certificateFile?.fileBase64}
        urlPdf={certificateFile?.urlPdf || certificateFile?.pdfUrl}
      />

      <AwardsManagerShareDialog
        open={shareDialog.value}
        shared={file?.shared}
        inviteEmail={inviteEmail}
        onChangeInvite={handleChangeInvite}
        onCopyLink={onCopyLink}
        onClose={() => {
          shareDialog.onFalse();
          setInviteEmail('');
        }}
      />
    </>
  );
}
