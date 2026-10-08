import { mergeClasses } from 'minimal-shared/utils';

import { styled } from '@mui/material/styles';

import { uploadClasses } from '../classes';
import { getFileMeta, useFilePreview } from '../../file-thumbnail';

// ----------------------------------------------------------------------

export function SingleFilePreview({ sx, file, className, ...other }) {
  const fileMeta = getFileMeta(file);
  const { previewUrl } = useFilePreview(file);

  return (
    <PreviewRoot
      className={mergeClasses([uploadClasses.preview.single, className])}
      sx={sx}
      {...other}
    >
      {previewUrl && <PreviewImage alt={fileMeta.name} src={previewUrl} />}
    </PreviewRoot>
  );
}

// ----------------------------------------------------------------------

const PreviewRoot = styled('div')(({ theme }) => ({
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  position: 'absolute',
  borderRadius: 'inherit',
  padding: theme.spacing(1),
}));

const PreviewImage = styled('img')({
  width: '100%',
  height: '100%',
  // En la landing la foto se ve entera, con su forma original: con 'cover' se
  // recortaba y no se sabía qué se iba a enviar. El contenedor no cambia.
  objectFit: 'contain',
  borderRadius: 'inherit',
});
