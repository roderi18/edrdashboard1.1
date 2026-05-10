import { optimizeImageFile } from 'src/utils/image-optimizer';

export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const stripHtml = (html = '') =>
  String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const ensureSubjectPrefix = (subject = '', prefix = 'Re:') => {
  const value = String(subject || 'Sin asunto').trim();

  return value.toLowerCase().startsWith(prefix.toLowerCase()) ? value : `${prefix} ${value}`;
};

export const parseRecipients = (value = '') =>
  String(value)
    .split(/[;,]/)
    .map((email) => email.trim())
    .filter(Boolean)
    .map((email) => ({
      email,
      name: email.split('@')[0] || email,
      avatarUrl: '',
    }));

export async function buildMailAttachments(files = []) {
  const attachments = await Promise.all(
    Array.from(files).map(async (file) => {
      const isImage = String(file.type || '').startsWith('image/');
      const preparedFile = isImage
        ? await optimizeImageFile(file, {
            maxWidth: 1800,
            maxHeight: 1800,
            quality: 0.94,
            mimeType: 'image/webp',
          })
        : file;
      const preview = isImage ? await fileToDataUrl(preparedFile) : undefined;

      return {
        id: `mail-attachment-${crypto.randomUUID()}`,
        name: preparedFile.name,
        size: preparedFile.size,
        type: preparedFile.type || file.type || 'application/octet-stream',
        preview:
          preview ||
          (preparedFile.type === 'application/pdf'
            ? '/assets/icons/files/ic-pdf.svg'
            : '/assets/icons/files/ic-file.svg'),
      };
    })
  );

  return attachments;
}
