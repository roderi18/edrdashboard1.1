import { varAlpha } from 'minimal-shared/utils';
import { useBoolean } from 'minimal-shared/hooks';
import { useRef, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Portal from '@mui/material/Portal';
import Tooltip from '@mui/material/Tooltip';
import Backdrop from '@mui/material/Backdrop';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';

import { sendMail } from 'src/actions/mail';

import { Editor } from 'src/components/editor';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { FileThumbnail } from 'src/components/file-thumbnail';

import { stripHtml, parseRecipients, buildMailAttachments } from './utils/compose-helpers';

// ----------------------------------------------------------------------

const POSITION = 20;

export function MailCompose({ onCloseCompose }) {
  const smUp = useMediaQuery((theme) => theme.breakpoints.up('sm'));

  const fullScreen = useBoolean();
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);

  const handleChangeMessage = useCallback((value) => {
    setMessage(value);
  }, []);

  const handleUploadFiles = useCallback(async (files) => {
    if (!files?.length) return;

    const nextAttachments = await buildMailAttachments(files);
    setAttachments((current) => [...current, ...nextAttachments]);
  }, []);

  const handleRemoveAttachment = useCallback((attachmentId) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  }, []);

  const handleSend = useCallback(async () => {
    const recipients = parseRecipients(to);
    const hasContent = stripHtml(message) || attachments.length;

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
        to: recipients,
        subject,
        message,
        attachments,
      });
      toast.success('Correo enviado.');
      onCloseCompose?.();
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'No se pudo enviar el correo.');
    } finally {
      setSending(false);
    }
  }, [attachments, message, onCloseCompose, subject, to]);

  useEffect(() => {
    document.body.style.overflow = fullScreen.value ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [fullScreen.value]);

  return (
    <Portal>
      {(fullScreen.value || !smUp) && (
        <Backdrop open sx={[(theme) => ({ zIndex: theme.zIndex.modal - 1 })]} />
      )}

      <Paper
        sx={[
          (theme) => ({
            maxWidth: 560,
            right: POSITION,
            borderRadius: 2,
            display: 'flex',
            bottom: POSITION,
            position: 'fixed',
            overflow: 'hidden',
            flexDirection: 'column',
            zIndex: theme.zIndex.modal,
            width: `calc(100% - ${POSITION * 2}px)`,
            boxShadow: theme.vars.customShadows.dropdown,
            ...(fullScreen.value && { maxWidth: 1, height: `calc(100% - ${POSITION * 2}px)` }),
          }),
        ]}
      >
        <Box
          sx={[
            (theme) => ({
              display: 'flex',
              alignItems: 'center',
              bgcolor: 'background.neutral',
              p: theme.spacing(1.5, 1, 1.5, 2),
            }),
          ]}
        >
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Nuevo mensaje
          </Typography>

          <IconButton onClick={fullScreen.onToggle}>
            <Iconify icon={fullScreen.value ? 'eva:collapse-fill' : 'eva:expand-fill'} />
          </IconButton>

          <IconButton onClick={onCloseCompose}>
            <Iconify icon="mingcute:close-line" />
          </IconButton>
        </Box>

        <InputBase
          id="mail-compose-to"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          placeholder="Para"
          endAdornment={
            <Box sx={{ gap: 0.5, display: 'flex', typography: 'subtitle2' }}>
              <Box sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>Cc</Box>
              <Box sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>Cco</Box>
            </Box>
          }
          sx={[
            (theme) => ({
              px: 2,
              height: 48,
              borderBottom: `solid 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.08)}`,
            }),
          ]}
        />

        <InputBase
          id="mail-compose-subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Asunto"
          sx={[
            (theme) => ({
              px: 2,
              height: 48,
              borderBottom: `solid 1px ${varAlpha(theme.vars.palette.grey['500Channel'], 0.08)}`,
            }),
          ]}
        />

        <Box
          sx={{
            p: 2,
            gap: 2,
            display: 'flex',
            flex: '1 1 auto',
            overflow: 'hidden',
            flexDirection: 'column',
          }}
        >
          <Editor
            value={message}
            onChange={handleChangeMessage}
            placeholder="Escribe un mensaje"
            slotProps={{
              wrapper: { ...(fullScreen.value && { minHeight: 0, flex: '1 1 auto' }) },
            }}
            sx={{
              maxHeight: 480,
              ...(fullScreen.value && { maxHeight: 1, flex: '1 1 auto' }),
            }}
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

            <Box sx={{ flexGrow: 1 }} />

            <Button
              variant="contained"
              color="primary"
              disabled={sending}
              onClick={handleSend}
              endIcon={<Iconify icon="custom:send-fill" />}
            >
              Enviar
            </Button>
          </Box>
        </Box>
      </Paper>
    </Portal>
  );
}
