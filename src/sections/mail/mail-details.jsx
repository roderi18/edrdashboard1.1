import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { darken, lighten, alpha as hexAlpha } from '@mui/material/styles';

import { fDateTime } from 'src/utils/format-time';

import { CONFIG } from 'src/global-config';
import { sendMail, updateMail } from 'src/actions/mail';

import { Label } from 'src/components/label';
import { Editor } from 'src/components/editor';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Markdown } from 'src/components/markdown';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { FileThumbnail } from 'src/components/file-thumbnail';
import { LoadingScreen } from 'src/components/loading-screen';

import {
  stripHtml,
  parseRecipients,
  ensureSubjectPrefix,
  buildMailAttachments,
} from './utils/compose-helpers';

// ----------------------------------------------------------------------

const ACTION_LABELS = {
  reply: 'Responder',
  replyAll: 'Responder a todos',
  forward: 'Reenviar',
};

const uniqueRecipients = (recipients = []) =>
  Array.from(
    new Map(
      recipients
        .filter((recipient) => recipient?.email)
        .map((recipient) => [recipient.email.toLowerCase(), recipient])
    ).values()
  );

export function MailDetails({ mail, renderLabel, error, loading }) {
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isStarred, setIsStarred] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [actionMode, setActionMode] = useState('reply');
  const [forwardTo, setForwardTo] = useState('');
  const [editorMessage, setEditorMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const thread = mail?.thread?.length ? mail.thread : mail ? [mail] : [];

  useEffect(() => {
    setIsStarred(Boolean(mail?.isStarred));
    setIsImportant(Boolean(mail?.isImportant));
    setActionMode('reply');
    setForwardTo('');
    setEditorMessage('');
    setAttachments([]);
  }, [mail?.id, mail?.isImportant, mail?.isStarred]);

  const handleToggleMailState = useCallback(
    async (field, nextValue) => {
      if (!mail?.id) return;

      try {
        await updateMail(mail.id, { [field]: nextValue });
      } catch (updateError) {
        console.error(updateError);
        toast.error(updateError.message || 'No se pudo actualizar el correo.');
      }
    },
    [mail?.id]
  );

  const handleToggleStarred = useCallback(() => {
    const nextValue = !isStarred;
    setIsStarred(nextValue);
    handleToggleMailState('isStarred', nextValue);
  }, [handleToggleMailState, isStarred]);

  const handleToggleImportant = useCallback(() => {
    const nextValue = !isImportant;
    setIsImportant(nextValue);
    handleToggleMailState('isImportant', nextValue);
  }, [handleToggleMailState, isImportant]);

  const handleMarkUnread = useCallback(() => {
    handleToggleMailState('isUnread', true);
    toast.success('Correo marcado como no leído.');
  }, [handleToggleMailState]);

  const handleUploadFiles = useCallback(async (files) => {
    if (!files?.length) return;

    const nextAttachments = await buildMailAttachments(files);
    setAttachments((current) => [...current, ...nextAttachments]);
  }, []);

  const handleRemoveAttachment = useCallback((attachmentId) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  }, []);

  const handleSelectAction = useCallback((mode) => {
    setActionMode(mode);
    setEditorMessage('');
    setAttachments([]);
  }, []);

  const handleSend = useCallback(async () => {
    const recipients =
      actionMode === 'forward'
        ? parseRecipients(forwardTo)
        : uniqueRecipients(actionMode === 'replyAll' ? [mail?.from, ...(mail?.to || [])] : [mail?.from]);
    const hasContent = stripHtml(editorMessage) || attachments.length;

    if (!recipients.length) {
      toast.error('Agrega al menos un destinatario.');
      return;
    }

    if (!hasContent) {
      toast.error('Escribe un mensaje o adjunta un archivo.');
      return;
    }

    try {
      setSending(true);
      await sendMail({
        sourceMailId: mail.id,
        to: recipients,
        subject: ensureSubjectPrefix(mail.subject, actionMode === 'forward' ? 'Rv:' : 'Re:'),
        message: editorMessage,
        attachments,
      });
      setEditorMessage('');
      setForwardTo('');
      setAttachments([]);
      toast.success('Correo enviado.');
    } catch (sendError) {
      console.error(sendError);
      toast.error(sendError.message || 'No se pudo enviar el correo.');
    } finally {
      setSending(false);
    }
  }, [actionMode, attachments, editorMessage, forwardTo, mail]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <EmptyContent
        title={error}
        imgUrl={`${CONFIG.assetsDir}/assets/icons/empty/ic-email-disabled.svg`}
      />
    );
  }

  const renderHead = () => (
    <>
      <Box sx={{ gap: 1, flexGrow: 1, display: 'flex' }}>
        {mail?.labelIds.map((labelId) => {
          const label = renderLabel?.(labelId);

          if (!label) return null;

          return (
            <Label
              key={label.id}
              sx={[
                (theme) => ({
                  color: darken(label.color, 0.24),
                  bgcolor: hexAlpha(label.color, 0.16),
                  ...theme.applyStyles('dark', {
                    color: lighten(label.color, 0.24),
                  }),
                }),
              ]}
            >
              {label.name}
            </Label>
          );
        })}
      </Box>

      <Box
        sx={{ display: 'flex', flex: '1 1 auto', alignItems: 'center', justifyContent: 'flex-end' }}
      >
        <Checkbox
          color="warning"
          icon={<Iconify icon="eva:star-outline" />}
          checkedIcon={<Iconify icon="eva:star-fill" />}
          checked={isStarred}
          onChange={handleToggleStarred}
          slotProps={{
            input: {
              id: 'starred-checkbox',
              'aria-label': 'Marcar como destacado',
            },
          }}
        />

        <Checkbox
          color="warning"
          icon={<Iconify icon="ic:round-label-important" />}
          checkedIcon={<Iconify icon="ic:round-label-important" />}
          checked={isImportant}
          onChange={handleToggleImportant}
          slotProps={{
            input: {
              id: 'important-checkbox',
              'aria-label': 'Marcar como importante',
            },
          }}
        />

        <Tooltip title="Archivar">
          <IconButton>
            <Iconify icon="solar:archive-down-minimlistic-bold" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Marcar como no leído">
          <IconButton onClick={handleMarkUnread}>
            <Iconify icon="solar:letter-unread-bold" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Eliminar">
          <IconButton>
            <Iconify icon="solar:trash-bin-trash-bold" />
          </IconButton>
        </Tooltip>

        <IconButton>
          <Iconify icon="eva:more-vertical-fill" />
        </IconButton>
      </Box>
    </>
  );

  const renderSubject = () => (
    <>
      <Typography
        variant="subtitle2"
        sx={[
          (theme) => ({
            ...theme.mixins.maxLine({ line: 2 }),
            flex: '1 1 auto',
          }),
        ]}
      >
        {mail?.subject}
      </Typography>

      <Stack spacing={0.5}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Tooltip title="Responder">
            <IconButton size="small" onClick={() => handleSelectAction('reply')}>
              <Iconify width={18} icon="solar:reply-bold" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Responder a todos">
            <IconButton size="small" onClick={() => handleSelectAction('replyAll')}>
              <Iconify width={18} icon="solar:multiple-forward-left-broken" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Reenviar">
            <IconButton size="small" onClick={() => handleSelectAction('forward')}>
              <Iconify width={18} icon="solar:forward-bold" />
            </IconButton>
          </Tooltip>
        </Box>

        <Typography variant="caption" noWrap sx={{ color: 'text.disabled' }}>
          {fDateTime(mail?.createdAt)}
        </Typography>
      </Stack>
    </>
  );

  const renderSender = (message = mail) => (
    <>
      <Avatar
        alt={message?.from.name}
        src={message?.from.avatarUrl ? `${message?.from.avatarUrl}` : ''}
        sx={{ mr: 2 }}
      >
        {message?.from.name.charAt(0).toUpperCase()}
      </Avatar>

      <Stack spacing={0.5} sx={{ width: 0, flexGrow: 1 }}>
        <Box sx={{ gap: 0.5, display: 'flex' }}>
          <Typography component="span" variant="subtitle2" sx={{ flexShrink: 0 }}>
            {message?.from.name}
          </Typography>
          <Typography component="span" noWrap variant="body2" sx={{ color: 'text.secondary' }}>
            {`<${message?.from.email}>`}
          </Typography>
        </Box>

        <Typography noWrap component="span" variant="caption" sx={{ color: 'text.secondary' }}>
          {`Para: `}
          {message?.to.map((person) => (
            <Link key={person.email} color="inherit" sx={{ '&:hover': { color: 'text.primary' } }}>
              {`${person.email}, `}
            </Link>
          ))}
        </Typography>
      </Stack>
    </>
  );

  const renderAttachments = (message) => (
    <Stack spacing={1} sx={{ p: 1.25, borderRadius: 1, bgcolor: 'background.neutral' }}>
      <Typography
        variant="caption"
        sx={{ gap: 0.5, display: 'flex', alignItems: 'center', color: 'text.secondary' }}
      >
        <Iconify icon="eva:attach-2-fill" />
        {message.attachments.length === 1 ? '1 adjunto' : `${message.attachments.length} adjuntos`}
      </Typography>

      <Box sx={{ gap: 0.75, display: 'flex', flexWrap: 'wrap' }}>
        {message.attachments.map((attachment) => (
          <FileThumbnail
            key={attachment.id}
            tooltip
            showImage
            file={attachment.preview}
            slotProps={{ icon: { sx: { width: 24, height: 24 } } }}
            sx={{ width: 48, height: 48, bgcolor: 'background.paper' }}
          />
        ))}
      </Box>
    </Stack>
  );

  const renderThreadMessage = (message, index) => (
    <Stack
      key={message.id}
      spacing={2}
      sx={[
        (theme) => ({
          p: 2,
          borderRadius: 1.5,
          bgcolor: index === thread.length - 1 ? 'background.neutral' : 'transparent',
          border: `1px solid ${theme.vars.palette.divider}`,
        }),
      ]}
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {renderSender(message)}

        <Typography variant="caption" sx={{ color: 'text.disabled', whiteSpace: 'nowrap' }}>
          {fDateTime(message.createdAt)}
        </Typography>
      </Box>

      {!!message?.attachments.length && renderAttachments(message)}

      <Markdown children={message.message} sx={{ '& p': { typography: 'body2' } }} />
    </Stack>
  );

  const renderEditor = () => (
    <>
      <Stack spacing={1}>
        <Typography variant="subtitle2">{ACTION_LABELS[actionMode]}</Typography>

        {actionMode === 'forward' && (
          <InputBase
            value={forwardTo}
            onChange={(event) => setForwardTo(event.target.value)}
            placeholder="Para"
            sx={(theme) => ({
              px: 1.5,
              height: 40,
              borderRadius: 1,
              border: `solid 1px ${theme.vars.palette.divider}`,
            })}
          />
        )}
      </Stack>

      <Editor
        value={editorMessage}
        onChange={setEditorMessage}
        placeholder="Escribe un mensaje"
        sx={{ maxHeight: 320 }}
      />

      {!!attachments.length && (
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          {attachments.map((attachment) => (
            <FileThumbnail
              key={attachment.id}
              tooltip
              showImage
              file={attachment.preview}
              onRemove={() => handleRemoveAttachment(attachment.id)}
              sx={{ width: 44, height: 44, bgcolor: 'background.neutral' }}
            />
          ))}
        </Stack>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <input
          ref={imageInputRef}
          hidden
          multiple
          type="file"
          accept="image/*"
          onChange={(event) => {
            handleUploadFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <input
          ref={fileInputRef}
          hidden
          multiple
          type="file"
          onChange={(event) => {
            handleUploadFiles(event.target.files);
            event.target.value = '';
          }}
        />

        <Tooltip title="Subir fotos">
          <IconButton onClick={() => imageInputRef.current?.click()}>
            <Iconify icon="solar:gallery-add-bold" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Subir documentos">
          <IconButton onClick={() => fileInputRef.current?.click()}>
            <Iconify icon="eva:attach-2-fill" />
          </IconButton>
        </Tooltip>

        <Stack sx={{ flexGrow: 1 }} />

        <Button
          color="primary"
          variant="contained"
          disabled={sending}
          onClick={handleSend}
          endIcon={<Iconify icon="custom:send-fill" />}
        >
          Enviar
        </Button>
      </Box>
    </>
  );

  return (
    mail && (
      <>
        <Box
          sx={{
            pl: 2,
            pr: 1,
            py: 1,
            gap: 1,
            minHeight: 56,
            flexShrink: 0,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {renderHead()}
        </Box>

        <Box
          sx={[
            (theme) => ({
              p: 2,
              gap: 2,
              flexShrink: 0,
              display: 'flex',
              borderTop: `1px dashed ${theme.vars.palette.divider}`,
              borderBottom: `1px dashed ${theme.vars.palette.divider}`,
            }),
          ]}
        >
          {renderSubject()}
        </Box>

        <Scrollbar sx={{ flex: '1 1 240px' }}>
          <Stack spacing={2} sx={{ p: 2 }}>
            {thread.map(renderThreadMessage)}
          </Stack>
        </Scrollbar>

        <Stack spacing={2} sx={{ flexShrink: 0, p: 2 }}>
          {renderEditor()}
        </Stack>
      </>
    )
  );
}
