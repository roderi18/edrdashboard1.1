'use client';


import { useRef, useState, useCallback } from 'react';
import { useBoolean, usePopover, useCopyToClipboard } from 'minimal-shared/hooks';

import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';

import { isDestacamentoApprovalRole } from 'src/utils/member-access';

import { getAwardsProgressCache } from 'src/services/awards-progress-cache';
import { sincronizarProgresoAscensoFirebase } from 'src/services/member-awards-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { CustomPopover } from 'src/components/custom-popover';

import { createAwardsActions } from 'src/sections/member/awards/components/core/AwardsActionsCore';
import {
  FileItem,
  FileItemInfo,
  AwardsItemIcon,
  FileItemAvatar,
  FileItemActions,
  FileItemActionOverlay,
} from 'src/sections/member/awards/awards-manager-file-item-slots';

import { useAuthContext } from 'src/auth/hooks';

import { AwardsInsigniaItem } from './awards-insignia-item';
import { useAwardFavorite } from './hooks/use-award-favorite';
import { FileManagerFileDetails } from './awards-manager-file-details';
import { AwardsManagerShareDialog } from './awards-manager-share-dialog';
import { buildStatusChangeMessage } from './utils/status-change-message';
import { getCompletionGridLabel } from './utils/get-completion-grid-label';

// } from 'src/sections/file-manager/awards-manager-file-item-slots';
const INSTRUCTOR_ID = 'instructor';
// ----------------------------------------------------------------------

export function FileManagerFileItem({
  file,
  selected,
  onSelect,
  isGridView = false,
  onDelete,
  readOnly = false,
  inlineDetails = false,
  insignia = false,
  modoSeleccion = false,
  sx,
  ...other
}) {


  const isAcademiaMinisterialFile =
    file.parentId === INSTRUCTOR_ID ||
    file.parentName === 'Instructor';

  const { user } = useAuthContext();
  const montados = useRef({});
  const shareDialog = useBoolean();
  const confirmDialog = useBoolean();
  const detailsDrawer = useBoolean();
  const menuActions = usePopover();

  const checkbox = useBoolean();
  const { favorited, onToggleFavorite } = useAwardFavorite({
    memberId: file?.memberId,
    item: file,
    initialValue: file.isFavorited,
  });

  const { copy } = useCopyToClipboard();

  const [inviteEmail, setInviteEmail] = useState('');

  const handleChangeInvite = useCallback((event) => {
    setInviteEmail(event.target.value);
  }, []);

  const handleCopy = useCallback(() => {
    toast.success('Copiado!');
    copy(file.url);
  }, [copy, file.url]);

  // "Completar" / "Quitar completado" desde el menú (⋮), sin abrir el panel.
  // Solo en el Sistema de Ascenso (en Academia el certificado es obligatorio y
  // se completa desde el panel). Usan las MISMAS acciones que el panel lateral:
  // guardan en Firestore y dejan historial.
  const puedeCompletar = !readOnly && file?.systemSent === 'sistemaAscenso' && !!file?.sectionId;
  const yaCompletado = file?.status === 'completado';
  const quitarCompletadoDialog = useBoolean();
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  // Pastor, Consejo, Capellán, Líderes…: quitar un completado queda pendiente de
  // aprobación. El Coordinador de Destacamento y su Asistente lo aplican al confirmar.
  const necesitaAprobacion = isDestacamentoApprovalRole(user);

  const accionesDelPremio = () =>
    createAwardsActions({
      system: 'sistemaAscenso',
      memberId: file.memberId,
      context: { sectionId: file.sectionId, parentId: file.parentId, rowId: file.id },
      metadata: {
        nombreItemAscenso: file.name,
        idGrupo: file.parentId,
        nombreGrupo: file.parentName || file.parentId,
        idDivision: file.sectionId,
      },
      user,
    });

  const tieneCertificado = () =>
    Boolean(
      getAwardsProgressCache(file.memberId).data?.sistemaAscenso?.[file.sectionId]?.[
        file.parentId
      ]?.[file.id]?.certificate
    );

  // Si Firestore no lo guardó: aviso y relectura, para no dejar en pantalla
  // algo que no está en la base de datos.
  const siNoSeGuardo = async (promesa, texto) => {
    if ((await promesa) !== false) return;
    toast.error(`No se pudo guardar "${file.name}" ${texto}. Inténtalo de nuevo.`);
    sincronizarProgresoAscensoFirebase(file.memberId, { fresco: true }).catch(() => null);
  };

  // Al instante: se escribe primero en memoria (el check sale ya) y Firestore
  // se guarda por detrás; el aviso de éxito no espera a la red.
  const completar = () => {
    const promesa = accionesDelPremio().setStatus('completado');
    toast.success(`${file.name}: completado.`);
    siNoSeGuardo(promesa, 'como completado');
  };

  // Quitar un completado sigue la regla del panel: siempre con aviso de
  // confirmación, que dice si se pedirá aprobación y si se borrará el certificado.
  const confirmarQuitarCompletado = async () => {
    const certificado = tieneCertificado();
    const acciones = accionesDelPremio();

    if (!necesitaAprobacion) {
      quitarCompletadoDialog.onFalse();
      // Un solo guardado con el certificado quitado (antes eran dos que se pisaban).
      const promesa = acciones.applyStatusChange({
        nextStatus: 'no_iniciado',
        removeCertificate: certificado,
      });
      toast.success(`${file.name}: ya no está completado.`);
      siNoSeGuardo(promesa, 'sin completar');
      return;
    }

    setEnviandoSolicitud(true);
    try {
      await acciones.requestStatusChange({ nextStatus: 'no_iniciado', nextTimesCompleted: 0 });
      toast.success('Solicitud enviada a los Coordinadores de Destacamento.');
      quitarCompletadoDialog.onFalse();
    } catch (error) {
      console.error('[ascenso] no se pudo enviar la solicitud', error);
      toast.error(error.message || 'No se pudo enviar la solicitud.');
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  const renderQuitarCompletadoDialog = () =>
    puedeCompletar ? (
      <ConfirmDialog
        open={quitarCompletadoDialog.value}
        onClose={enviandoSolicitud ? undefined : quitarCompletadoDialog.onFalse}
        title={necesitaAprobacion ? 'Solicitar cambio de estado' : 'Quitar completado'}
        content={buildStatusChangeMessage({
          needsApproval: necesitaAprobacion,
          hasCertificate: quitarCompletadoDialog.value && tieneCertificado(),
        })}
        action={
          <Button variant="contained" loading={enviandoSolicitud} onClick={confirmarQuitarCompletado}>
            {necesitaAprobacion ? 'Enviar solicitud' : 'Quitar completado'}
          </Button>
        }
      />
    ) : null;

  // Lo que ya se abrió alguna vez sigue montado (ver el render).
  if (menuActions.open) montados.current.menu = true;
  if (shareDialog.value) montados.current.compartir = true;
  if (confirmDialog.value) montados.current.eliminar = true;
  if (quitarCompletadoDialog.value) montados.current.quitar = true;
  if (detailsDrawer.value) montados.current.panel = true;

  const renderMenuActions = () => (
    <CustomPopover
      open={menuActions.open}
      anchorEl={menuActions.anchorEl}
      onClose={menuActions.onClose}
      slotProps={{ arrow: { placement: 'right-top' } }}
    >
      <MenuList>
        {puedeCompletar && (
          <MenuItem
            onClick={() => {
              menuActions.onClose();
              if (yaCompletado) quitarCompletadoDialog.onTrue();
              else completar();
            }}
          >
            <Iconify
              icon={yaCompletado ? 'solar:restart-bold' : 'eva:checkmark-circle-2-outline'}
            />
            {yaCompletado ? 'Quitar completado' : 'Completar'}
          </MenuItem>
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

        <Divider sx={{ borderStyle: 'dashed' }} />

        <MenuItem
          onClick={() => {
            confirmDialog.onTrue();
            menuActions.onClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Iconify icon="solar:trash-bin-trash-bold" />
          Eliminar
        </MenuItem>
      </MenuList>
    </CustomPopover>
  );

  const renderShareDialog = () => (
    <AwardsManagerShareDialog
      open={shareDialog.value}
      shared={file.shared}
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
      content="Estás seguro que quieres eliminar?"
      action={
        <Button variant="contained" color="error" onClick={onDelete}>
          Eliminar
        </Button>
      }
    />
  );

  const isSistemaAscenso = !!file?.sectionId;


  const renderFileDetailsDrawer = () => (
    <FileManagerFileDetails
      file={file}
      memberId={file?.memberId}
      system={file?.systemSent}
      favorited={favorited}
      onFavorite={onToggleFavorite}
      onCopyLink={handleCopy}
      open={detailsDrawer.value}
      onClose={detailsDrawer.onFalse}
      onDelete={() => {
        detailsDrawer.onFalse();
        onDelete();
      }}
      isGridView={isGridView}
      readOnly={readOnly}
    />

  );


  return (
    <>
      {insignia ? (
        <AwardsInsigniaItem
          file={file}
          selected={selected}
          // Seleccionar varios es para completarlos de una vez: solo en el
          // Sistema de Ascenso (en Academia el certificado es obligatorio) y
          // para quien puede editar.
          onSelect={puedeCompletar ? onSelect : undefined}
          modoSeleccion={puedeCompletar && modoSeleccion}
          favorited={favorited}
          onToggleFavorite={onToggleFavorite}
          onOpen={detailsDrawer.onTrue}
          openMenu={menuActions.open}
          onOpenMenu={menuActions.onOpen}
          sx={sx}
          {...other}
        />
      ) : (
      <FileItem variant="outlined" selected={selected} sx={sx} {...other}>
        <FileItemActionOverlay
          onClick={(e) => {
            detailsDrawer.onTrue();
          }}
        />

        <AwardsItemIcon
          id={file.id}
          // parentId={file.parentId}
          fileType={file.type}
          onMouseEnter={checkbox.onTrue}
          onMouseLeave={checkbox.onFalse}
          hovered={checkbox.value}
          checked={selected}
          onChange={onSelect}
        />

        <FileItemInfo
          type="file"
          title={file.name}
          inlineDetails={inlineDetails}
          values={
            getCompletionGridLabel(file)
              ? [getCompletionGridLabel(file)]
              : []
          }



          sx={inlineDetails ? {
            gap: 0,
            '& .MuiTypography-root': { lineHeight: 1.15 },
            '& .MuiStack-root': { gap: 0, lineHeight: 1.1 },
          } : {
            gap: 0, // ✅ permitido

            // TÍTULO
            '& .MuiTypography-root': {
              lineHeight: 1.15,
              marginBottom: '-18px',
            },

            // DETALLE ("Completado...")
            '& .MuiStack-root': {
              marginTop: 0,
              paddingTop: 0,
              gap: 0,
              lineHeight: 1.1,
              marginBottom: '-8px',
            },
          }}
        />


        <FileItemAvatar sharedUsers={file.shared} />

        <FileItemActions
          id={file.id}
          checked={favorited}
          onChange={onToggleFavorite}
          openMenu={menuActions.open}
          onOpenMenu={menuActions.onOpen}
        />
      </FileItem>
      )}

      {/* Cada tarjeta montaba SIEMPRE su panel lateral, su menú y sus diálogos,
          aunque estuvieran cerrados: con 59 premios, cada clic (seleccionar con
          Ctrl, completar…) repintaba 59 paneles. Ahora se montan la primera vez
          que se abren y se quedan (así el cierre sigue animado). */}
      {montados.current.menu && renderMenuActions()}

      {montados.current.compartir && renderShareDialog()}
      {montados.current.eliminar && renderConfirmDialog()}
      {montados.current.quitar && renderQuitarCompletadoDialog()}

      {montados.current.panel && renderFileDetailsDrawer()}
    </>
  );
}
