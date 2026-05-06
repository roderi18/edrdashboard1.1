import { useBoolean } from 'minimal-shared/hooks';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Collapse from '@mui/material/Collapse';
import ListItemText from '@mui/material/ListItemText';

import { fData } from 'src/utils/format-number';
import { fDateTime } from 'src/utils/format-time';

import { FileThumbnail } from 'src/components/file-thumbnail';

import { CollapseButton } from './styles';

// ----------------------------------------------------------------------

export function ChatRoomAttachments({ attachments }) {
  const collapse = useBoolean(true);

  const totalAttachments = attachments.length;
  const totalAttachmentsSize = attachments.reduce(
    (total, attachment) =>
      total + Number(attachment?.size || attachment?.tamano || attachment?.tamanoOriginal || 0),
    0
  );

  const handleDownload = (attachmentUrl, attachmentName) => {
    if (!attachmentUrl) return;

    const link = document.createElement('a');
    link.href = attachmentUrl;
    link.download = attachmentName || 'adjunto';
    link.target = '_blank';
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const renderList = () =>
    attachments.map((attachment, index) => {
      const attachmentName =
        attachment?.name || attachment?.nombre || attachment?.nombreOriginal || `Adjunto ${index + 1}`;
      const attachmentPreview =
        attachment?.preview || attachment?.url || attachment?.downloadURL || attachmentName;
      const attachmentUrl = attachment?.url || attachment?.downloadURL || attachment?.preview;
      const attachmentCreatedAt = attachment?.createdAt || attachment?.fechaCarga;

      return (
      <Box
        key={`${attachment?.id || attachmentName || 'adjunto'}-${index}`}
        sx={{ gap: 1.5, display: 'flex', alignItems: 'center' }}
      >
        <FileThumbnail
          showImage
          file={attachmentPreview}
          onDownload={() => handleDownload(attachmentUrl, attachmentName)}
          slotProps={{
            icon: { sx: { width: 20, height: 20 } },
            downloadBtn: { sx: { '& svg': { width: 18, height: 18 } } },
          }}
          sx={{ width: 32, height: 32, bgcolor: 'background.neutral' }}
        />

        <ListItemText
          primary={attachmentName}
          secondary={fDateTime(attachmentCreatedAt)}
          slotProps={{
            primary: { noWrap: true, sx: { typography: 'body2' } },
            secondary: {
              noWrap: true,
              sx: {
                mt: 0.25,
                typography: 'caption',
                color: 'text.disabled',
              },
            },
          }}
        />
      </Box>
      );
    });

  return (
    <>
      <CollapseButton
        selected={collapse.value}
        disabled={!totalAttachments}
        onClick={collapse.onToggle}
      >
        {`Adjuntos (${totalAttachments})${totalAttachmentsSize ? ` - ${fData(totalAttachmentsSize)}` : ''}`}
      </CollapseButton>

      {!!totalAttachments && (
        <Collapse in={collapse.value}>
          <Stack spacing={2} sx={{ p: 2 }}>
            {renderList()}
          </Stack>
        </Collapse>
      )}
    </>
  );
}
