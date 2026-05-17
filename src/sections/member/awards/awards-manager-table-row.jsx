import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import { varAlpha } from 'minimal-shared/utils';
import { useState, useEffect, useCallback } from 'react';
import { useBoolean, usePopover, useDoubleClick, useCopyToClipboard } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import { useTheme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import TableRow, { tableRowClasses } from '@mui/material/TableRow';
import TableCell, { tableCellClasses } from '@mui/material/TableCell';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { FileThumbnail } from 'src/components/file-thumbnail';
import { CustomPopover } from 'src/components/custom-popover';

import { getFolderIcon } from 'src/sections/member/awards/utils/get-folder-icon';
import { getCustomFileIcon } from 'src/sections/member/awards/utils/get-file-icon';
import { FileItemActions } from 'src/sections/file-manager/file-manager-file-item-slots';
import { DownloadCertificateMenuItem } from 'src/sections/member/awards/components/certificate/DownloadCertificateMenuItem';

import { DefaultRow } from './components/rows/DefaultRow';
import { FileManagerFileDetails } from './awards-manager-file-details';
import { AwardsManagerShareDialog } from './awards-manager-share-dialog';
import { AcademiaSubRow } from './components/rows/academia/AcademiaSubRow';
import { getTotalAwards, getCompletedAwards } from '../awards/utils/get-awards-count';
import { SistemaAscensoRow } from './components/rows/sistema-ascenso/SistemaAscensoRow';
import { AcademiaMinisterialRow } from './components/rows/academia/AcademiaMinisterialRow';
import { SistemaAscensoSubRow } from './components/rows/sistema-ascenso/SistemaAscensoSubRow';
import { SistemaAscensoDeepRow } from './components/rows/sistema-ascenso/SistemaAscensoDeepRow';

// ----------------------------------------------------------------------

export function AwardsManagerTableRow({
  memberId,
  row,
  tableData,
  allData = [],
  selected,
  onSelectRow,
  onDeleteRow,
  onRename,
  isRootFolder = false,
  isAcademiaSubFolder = false,
  isAcademiaMinisterial = false,
  isSistemaAscenso = false,
  isSistemaAscensoSubFolder = false,
  isSistemaAscensoDeepSubFolder = false,
  showType = true,
  showAvatar = true,
  showThumbnail = true,
}) {
  const folderIcon = getFolderIcon({ id: row.id });

  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const handler = () => {
      forceUpdate((v) => v + 1);
    };

    window.addEventListener('awards-status-changed', handler);
    window.addEventListener('storage', handler);

    return () => {
      window.removeEventListener('awards-status-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const theme = useTheme();
  const router = useRouter();
  const isSistemaAscensoRow = row.id === 'sistema-de-ascenso';
  const isAcademiaMinisterialRow =
    row.type === 'folder' &&
    (row.id === 'academia-ministerial' || row.parentId === 'academia-ministerial');

  const isSistemaAscensoChild = row.parentId === 'sistema-de-ascenso';
  const isSistemaAscensoRootView = isSistemaAscenso && !isSistemaAscensoChild;

  const isChildOfSistemaAscenso = row.parentId === 'sistema-de-ascenso';

  const { copy } = useCopyToClipboard();

  const [inviteEmail, setInviteEmail] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const extension = row.name.split('.').pop();
  const baseName = row.name.replace(`.${extension}`, '');

  const shareDialog = useBoolean();
  const detailsDrawer = useBoolean();
  const confirmDialog = useBoolean();
  const menuActions = usePopover();
  const favorite = useBoolean(row.isFavorited);
  const [academiaCertificate, setAcademiaCertificate] = useState(null);
  const [ascensoCertificate, setAscensoCertificate] = useState(null);
  const [deleteCertCtx, setDeleteCertCtx] = useState(null);
  const ascensoSectionId = allData.find((i) => i.id === row.parentId)?.parentId || null;
  const academiaParent = allData.find((item) => item.id === row.parentId);
  const ascensoParent = allData.find((item) => item.id === row.parentId);
  const ascensoDivision = allData.find((item) => item.id === ascensoSectionId);
  const hasAcademiaCertificate = Boolean(
    academiaCertificate?.fileBase64 || academiaCertificate?.urlPdf || academiaCertificate?.pdfUrl
  );
  const hasAscensoCertificate = Boolean(
    ascensoCertificate?.fileBase64 || ascensoCertificate?.urlPdf || ascensoCertificate?.pdfUrl
  );

  // Estado del adiestramiento (solo Academia Subfolder)
  const [status, setStatus] = useState(row.status ?? 'no_iniciado');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!memberId) return;

    const key = `awards-status-${memberId}`;
    const saved = JSON.parse(localStorage.getItem(key) || '{}');

    const value = saved?.['academia-ministerial']?.[row.parentId]?.[row.id];

    if (value) {
      setStatus(value);
    }
  }, [memberId, row.id, row.parentId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!memberId || !isAcademiaSubFolder) return;

    const dataKey = `awards-data-${memberId}`;
    const saved = JSON.parse(localStorage.getItem(dataKey) || '{}');

    const cert = saved?.academia?.[row.parentId]?.[row.id]?.certificate;

    setAcademiaCertificate(cert ?? null);
  }, [memberId, row.parentId, row.id, isAcademiaSubFolder]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!memberId || !isSistemaAscensoDeepSubFolder) return;
    if (!ascensoSectionId) return;

    const dataKey = `awards-data-${memberId}`;
    const saved = JSON.parse(localStorage.getItem(dataKey) || '{}');

    const cert = saved?.sistemaAscenso?.[ascensoSectionId]?.[row.parentId]?.[row.id]?.certificate;

    setAscensoCertificate(cert ?? null);
  }, [memberId, isSistemaAscensoDeepSubFolder, ascensoSectionId, row.parentId, row.id]);

  const [completedDate, setCompletedDate] = useState(
    row.completedDate ? dayjs(row.completedDate) : null
  );

  const handleChangeInvite = useCallback((event) => {
    setInviteEmail(event.target.value);
  }, []);

  const handleClick = useDoubleClick({
    click: () => {
      if (row.type === 'folder') {
        router.push(`?folder=${row.id}`);
        return;
      }

      detailsDrawer.onTrue();
    },
    doubleClick: () => console.info('DOUBLE CLICK'),
  });

  // const totalAwards = isRootFolder
  //   ? getTotalAwards(row.id, tableData)
  //   : 0;
  const totalAwards = isRootFolder ? getTotalAwards(row.id, allData) : 0;

  const childrenCount = allData.filter((item) => item.parentId === row.id).length;

  const handleCopy = useCallback(() => {
    toast.success('Copiado!');
    copy(row.url);
  }, [copy, row.url]);

  const [ascensoStatus, setAscensoStatus] = useState(row.status ?? 'no_iniciado');

  const [ascensoCompletedDate, setAscensoCompletedDate] = useState(
    row.completedDate ?? new Date().toISOString().slice(0, 10)
  );

  const defaultStyles = {
    borderTop: `solid 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.16)}`,
    borderBottom: `solid 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.16)}`,
    '&:first-of-type': {
      borderTopLeftRadius: 16,
      borderBottomLeftRadius: 16,
      borderLeft: `solid 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.16)}`,
    },
    '&:last-of-type': {
      borderTopRightRadius: 16,
      borderBottomRightRadius: 16,
      borderRight: `solid 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.16)}`,
    },
  };

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'right-top' } }}
    >
      <MenuList>
        {isAcademiaSubFolder && hasAcademiaCertificate && (
          <DownloadCertificateMenuItem
            certificate={academiaCertificate}
            onClose={menuActions.onClose}
          />
        )}

        {isSistemaAscensoDeepSubFolder && hasAscensoCertificate && (
          <DownloadCertificateMenuItem
            certificate={ascensoCertificate}
            onClose={menuActions.onClose}
          />
        )}

        <MenuItem
          onClick={() => {
            menuActions.onClose();
            handleCopy();
          }}
        >
          <Iconify icon="eva:link-2-fill" />
          Copiar link
        </MenuItem>

        <MenuItem
          onClick={() => {
            menuActions.onClose();
            shareDialog.onTrue();
          }}
        >
          <Iconify icon="solar:share-bold" />
          Compartir
        </MenuItem>

        {isAcademiaSubFolder && hasAcademiaCertificate && (
          <Divider sx={{ borderStyle: 'dashed' }} />
        )}

        {isSistemaAscensoDeepSubFolder && hasAscensoCertificate && (
          <Divider sx={{ borderStyle: 'dashed' }} />
        )}

        {((isAcademiaSubFolder && hasAcademiaCertificate) ||
          (isSistemaAscensoDeepSubFolder && hasAscensoCertificate)) && (
          <MenuItem
            key="delete-cert"
            onClick={() => {
              menuActions.onClose();

              if (isAcademiaSubFolder) {
                setDeleteCertCtx({
                  type: 'academia',
                  parentId: row.parentId,
                  rowId: row.id,
                });
              } else if (isSistemaAscensoDeepSubFolder) {
                setDeleteCertCtx({
                  type: 'sistemaAscenso',
                  sectionId: ascensoSectionId,
                  parentId: row.parentId,
                  rowId: row.id,
                });
              }

              confirmDialog.onTrue();
            }}
            sx={{ color: 'error.main' }}
          >
            <Iconify icon="solar:trash-bin-trash-bold" />
            Eliminar certificado
          </MenuItem>
        )}
      </MenuList>
    </CustomPopover>
  );

  const renderFileDetailsDrawer = () =>
    row.type !== 'folder' ? (
      <FileManagerFileDetails
        file={{
          ...row,
          tags: row.tags ?? [],
          shared: row.shared ?? [],
          url: row.url ?? '',

          sectionId: row.sectionId ?? allData.find((i) => i.id === row.parentId)?.parentId,
        }}
        memberId={memberId}
        system={
          isSistemaAscensoDeepSubFolder || isSistemaAscensoSubFolder || isSistemaAscenso
            ? 'sistemaAscenso'
            : 'academia'
        }
        favorited={favorite.value}
        onFavorite={favorite.onToggle}
        onCopyLink={handleCopy}
        open={detailsDrawer.value}
        onClose={detailsDrawer.onFalse}
        onDelete={onDeleteRow}
      />
    ) : null;

  const renderShareDialog = () => (
    <AwardsManagerShareDialog
      open={shareDialog.value}
      shared={row.shared}
      inviteEmail={inviteEmail}
      onChangeInvite={handleChangeInvite}
      onCopyLink={handleCopy}
      onClose={() => {
        shareDialog.onFalse();
        setInviteEmail('');
      }}
    />
  );

  const renderConfirmDialog = () => (
    <ConfirmDialog
      open={confirmDialog.value}
      onClose={confirmDialog.onFalse}
      title="Eliminar"
      content="¿Deseas eliminar este certificado?"
      action={
        <Button
          variant="contained"
          color="error"
          onClick={() => {
            const dataKey = `awards-data-${memberId}`;
            const saved = JSON.parse(localStorage.getItem(dataKey) || '{}');

            if (deleteCertCtx?.type === 'academia') {
              const { parentId, rowId } = deleteCertCtx;

              if (saved?.academia?.[parentId]?.[rowId]?.certificate) {
                delete saved.academia[parentId][rowId].certificate;
                localStorage.setItem(dataKey, JSON.stringify(saved));
              }

              setAcademiaCertificate(null);
            }

            if (deleteCertCtx?.type === 'sistemaAscenso') {
              const { sectionId, parentId, rowId } = deleteCertCtx;

              if (saved?.sistemaAscenso?.[sectionId]?.[parentId]?.[rowId]?.certificate) {
                delete saved.sistemaAscenso[sectionId][parentId][rowId].certificate;
                localStorage.setItem(dataKey, JSON.stringify(saved));
              }

              setAscensoCertificate(null);
            }

            setDeleteCertCtx(null);
            confirmDialog.onFalse();
            window.dispatchEvent(new Event('storage'));
          }}
        >
          Sí, eliminar
        </Button>
      }
    />
  );

  return (
    <>
      <TableRow
        selected={selected}
        sx={{
          borderRadius: 2,
          cursor: row.type === 'folder' ? 'pointer' : 'default',
          [`&.${tableRowClasses.selected}, &:hover`]: {
            backgroundColor: 'background.paper',
            boxShadow: theme.vars.customShadows.z20,
            transition: theme.transitions.create(['background-color', 'box-shadow'], {
              duration: theme.transitions.duration.shortest,
            }),
            '&:hover': {
              backgroundColor: 'background.paper',
              boxShadow: theme.vars.customShadows.z20,
            },
          },
          [`& .${tableCellClasses.root}`]: {
            ...defaultStyles,
          },
          ...(detailsDrawer.value && {
            [`& .${tableCellClasses.root}`]: {
              ...defaultStyles,
            },
          }),
        }}
      >
        <TableCell padding="checkbox">
          <Checkbox
            checked={selected}
            onClick={onSelectRow}
            onDoubleClick={() => console.info('ON DOUBLE CLICK')}
            slotProps={{
              input: {
                id: `${row.id}-checkbox`,
                'aria-label': `${row.id} checkbox`,
              },
            }}
          />
        </TableCell>

        <TableCell onClick={handleClick}>
          {/* <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}> */}
          <Box
            sx={{
              gap: 2,
              display: 'flex',
              alignItems: 'center',
              cursor: row.type === 'folder' ? 'pointer' : 'default',
            }}
          >
            {/* {showThumbnail && <FileThumbnail file={row.type} />} */}
            {showThumbnail &&
              (() => {
                // 📄 Archivos (PDF, etc.)
                if (row.type !== 'folder') {
                  const customPdf = getCustomFileIcon({ id: row.id });

                  return customPdf ? (
                    <Box
                      component="img"
                      src={customPdf.src}
                      sx={{
                        width: customPdf.size,
                        height: customPdf.size,
                        objectFit: 'contain',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <FileThumbnail file={row.type} />
                  );
                }

                // 📁 Carpetas
                const customFolder = getFolderIcon({ id: row.id });

                return (
                  <Box
                    component="img"
                    src={customFolder?.src || '/assets/icons/files/ic-folder.svg'}
                    sx={{
                      width: customFolder?.size ?? 32,
                      height: customFolder?.size ?? 32,
                      objectFit: 'contain',
                      flexShrink: 0,
                    }}
                  />
                );
              })()}

            <Typography
              noWrap
              variant="inherit"
              sx={{
                maxWidth: 360,
                cursor: 'pointer',
                ...(detailsDrawer.value && { fontWeight: 'fontWeightBold' }),
              }}
            >
              {row.name}
            </Typography>
          </Box>
        </TableCell>

        {/* ===================== */}
        {/* COLUMNAS NORMALES */}
        {/* ===================== */}

        {!isSistemaAscensoRow &&
          !isSistemaAscensoChild &&
          !isAcademiaMinisterialRow &&
          !isSistemaAscensoDeepSubFolder &&
          !isAcademiaSubFolder && (
            <DefaultRow
              memberId={memberId}
              row={{
                ...row,
                total: row.type === 'folder' ? getTotalAwards(row.id, allData) : 0,
                allData,
              }}
              onClick={handleClick}
            />
          )}

        {isAcademiaMinisterialRow && (
          <AcademiaMinisterialRow
            memberId={memberId}
            row={{
              ...row,
              total: getTotalAwards(row.id, allData),
              completed: getCompletedAwards(row.id, memberId),
            }}
            onClick={handleClick}
            showTarget={isRootFolder}
          />
        )}

        {isSistemaAscensoRow && (
          <SistemaAscensoRow
            memberId={memberId}
            row={{
              ...row,
              total: getTotalAwards(row.id, allData),
            }}
            allData={allData}
            onClick={handleClick}
          />
        )}

        {isSistemaAscensoChild && !isSistemaAscensoDeepSubFolder && (
          <SistemaAscensoSubRow
            memberId={memberId}
            row={{
              ...row,
              total: getTotalAwards(row.id, allData),
              completed: getCompletedAwards(row.id, allData),
            }}
            allData={allData}
            onClick={handleClick}
          />
        )}

        {isSistemaAscensoDeepSubFolder && (
          <SistemaAscensoDeepRow
            memberId={memberId}
            rowId={row.id}
            parentId={row.parentId} // premios-requeridos
            sectionId={allData.find((i) => i.id === row.parentId)?.parentId} // exploradores
            metadata={{
              nombreItemAscenso: row.name,
              idGrupo: row.parentId,
              nombreGrupo: ascensoParent?.name || row.parentId,
              idDivision: ascensoSectionId || '',
              nombreDivision: ascensoDivision?.name || '',
            }}
            status={ascensoStatus}
            setStatus={setAscensoStatus}
            completedDate={completedDate}
            setCompletedDate={setCompletedDate}
            onCertificateUploaded={(cert) => setAscensoCertificate(cert)}
            onCertificateDeleted={() => setAscensoCertificate(null)}
          />
        )}

        {/* ===================== */}
        {/* SUBCARPETAS ACADEMIA */}
        {/* ===================== */}
        {isAcademiaSubFolder && (
          <AcademiaSubRow
            memberId={memberId}
            rowId={row.id}
            parentId={row.parentId}
            metadata={{
              nombreItemAscenso: row.name,
              idGrupo: row.parentId,
              nombreGrupo: academiaParent?.name || row.parentId,
            }}
            completedDate={completedDate}
            setCompletedDate={setCompletedDate}
            onCertificateUploaded={(cert) => {
              setAcademiaCertificate(cert);
            }}
            onCertificateDeleted={() => {
              setAcademiaCertificate(null);
            }}
          />
        )}

        {/* Mantener al final */}
        <TableCell align="right" sx={{ px: 0 }}>
          <FileItemActions
            id={row.id}
            checked={favorite.value}
            onChange={favorite.onToggle}
            openMenu={menuActions.open}
            onOpenMenu={menuActions.onOpen}
            sx={{ position: 'static' }}
          />
        </TableCell>
      </TableRow>

      {renderFileDetailsDrawer()}
      {renderShareDialog()}

      {renderMenuActions()}
      {renderConfirmDialog()}

      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 0 }}>Renombrar documento</DialogTitle>

        <Box
          sx={{
            px: 3,
            pt: 2,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <TextField
            autoFocus
            fullWidth
            label="Nombre del archivo"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            helperText={`La extensión .${extension} se mantiene`}
          />
        </Box>

        <DialogActions>
          <Button onClick={() => setRenameOpen(false)}>Cancelar</Button>

          <Button
            variant="contained"
            onClick={() => {
              if (!newName.trim()) return;

              const success = onRename?.(row.id, newName.trim());

              if (success) {
                setRenameOpen(false);
              }
            }}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
