import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import { styled } from '@mui/material/styles';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import AvatarGroup, { avatarGroupClasses } from '@mui/material/AvatarGroup';

import { Iconify } from 'src/components/iconify';
import { FileThumbnail } from 'src/components/file-thumbnail';

import { getFolderIcon } from 'src/sections/member/awards/utils/get-folder-icon';
import { getCustomFileIcon } from 'src/sections/member/awards/utils/get-file-icon';

// ----------------------------------------------------------------------

const Z_INDEXES = {
  overlay: 1,
  actions: 2,
};

export const FileItem = styled(Paper, {
  shouldForwardProp: (prop) =>
    !['selected', 'sx', 'parentId'].includes(prop),
})(({ selected, theme }) => {
    const hoverStyles = {
      boxShadow: theme.vars.customShadows.z20,
      backgroundColor: theme.vars.palette.background.paper,
    };

    return {
      display: 'flex',
      position: 'relative',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: theme.spacing(1.5),
      padding: theme.spacing(2.5),
      backgroundColor: 'transparent',
      borderRadius: Number(theme.shape.borderRadius) * 2,
      '&:hover': hoverStyles,
      ...(selected && hoverStyles),
    };
  });

export const FileItemActionOverlay = styled('span')({
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  cursor: 'pointer',
  position: 'absolute',
  borderRadius: 'inherit',
  zIndex: Z_INDEXES.overlay,
});

// ----------------------------------------------------------------------
export function AwardsItemIcon({ id, fileType, checked, hovered, onChange, sx }) {

  const isFolder = fileType === 'folder';
  const custom = isFolder ? getFolderIcon({ id }) : null;

  const renderIcon = () => {
    // PDF / archivos
    if (fileType && fileType !== 'folder') {
      //   id,
      //   fileType,
      // });

      const customPdf = getCustomFileIcon({ id: fileType === 'pdf' ? id : null });

      return customPdf ? (
        <Box
          component="img"
          loading="lazy"
          decoding="async"
          src={customPdf.src}
          sx={{ width: customPdf.size, height: customPdf.size, objectFit: 'contain' }}
        />
      ) : (
        <FileThumbnail file={fileType} sx={{ width: 1, height: 1 }} />
      );
    }

    // Carpetas
    if (custom) {
      return (
        <Box
          component="img"
          loading="lazy"
          decoding="async"
          src={custom.src}
          sx={{ width: custom.size, height: custom.size, objectFit: 'contain' }}
        />
      );
    }

    return <FileThumbnail file={fileType} sx={{ width: 1, height: 1 }} />;
  };


  return (
    <Box
      sx={[
        { width: 36, height: 36, display: 'inline-flex', zIndex: 2 },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {(hovered || checked) && onChange ? (
        <Checkbox
          checked={checked}
          onChange={(e) => {
            e.stopPropagation();
            onChange?.(e);
          }}
          icon={<Iconify icon="eva:radio-button-off-fill" width={22} />}
          checkedIcon={<Iconify icon="solar:check-circle-bold" width={22} />}
          sx={{ p: 0, width: 1, height: 1 }}
        />
      ) : (
        renderIcon()
      )}
    </Box>
  );
}


// ----------------------------------------------------------------------

export function FileItemInfo({ type, title, values, inlineDetails = false, sx, ...other }) {
  const renderTitle = () => (
    <Typography
      variant={['file', 'recent-file'].includes(type) ? 'subtitle2' : 'subtitle1'}
      sx={[
        (theme) =>
          inlineDetails
            ? {
                wordBreak: 'normal',
                overflowWrap: 'anywhere',
              }
            : {
                wordBreak: 'break-all',
                ...theme.mixins.maxLine({
                  line: type === 'file' ? 2 : 1,
                  persistent: type === 'file' ? theme.typography.subtitle2 : undefined,
                }),
              },
      ]}
    >
      {title}
    </Typography>
  );

  const renderDetails = () => (
    <Stack
      divider={
        <Box
          component="span"
          sx={{ width: 2, height: 2, flexShrink: 0, borderRadius: '50%', bgcolor: 'currentColor' }}
        />
      }
      sx={[
        (theme) => ({
          gap: 0.75,
          flexDirection: 'row',
          alignItems: 'center',
          typography: 'caption',
          color: 'text.disabled',
          ...(inlineDetails && {
            '&::before': {
              content: '"-"',
              mx: 0.75,
              color: 'text.secondary',
            },
          }),
          '& span': {
            '&:last-of-type': { ...theme.mixins.maxLine({ line: 1 }) },
            '&:not(:last-of-type)': { whiteSpace: 'nowrap' },
          },
        }),
      ]}
    >
      {values.map((value) => (
        <span key={value}>{value}</span>
      ))}
    </Stack>
  );

  return (
    <Box
      sx={[
        {
          gap: 0.5,
          width: 1,
          display: 'flex',
          flexDirection: inlineDetails ? 'row' : 'column',
          flexWrap: inlineDetails ? 'wrap' : 'nowrap',
          alignItems: inlineDetails ? 'baseline' : 'stretch',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {renderTitle()}
      {renderDetails()}
    </Box>
  );
}

// ----------------------------------------------------------------------

export function FileItemActions({ sx, id, checked, onChange, openMenu, onOpenMenu, ...other }) {
  return (
    <Box
      sx={[
        {
          top: 8,
          right: 8,
          display: 'flex',
          position: 'absolute',
          alignItems: 'center',
          zIndex: Z_INDEXES.actions,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <Checkbox
        color="warning"
        icon={<Iconify icon="eva:star-outline" />}
        checkedIcon={<Iconify icon="eva:star-fill" />}
        checked={checked}
        onChange={(e) => {
          e.stopPropagation();
          onChange?.(e);
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
        slotProps={{
          input: {
            id: `favorite-${id}-checkbox`,
            'aria-label': `Favorite ${id} checkbox`,
          },
        }}
      />


      {/* <IconButton color={openMenu ? 'inherit' : 'default'} onClick={onOpenMenu}> */}
      <IconButton
        color={openMenu ? 'inherit' : 'default'}
        onClick={(e) => {
          e.stopPropagation();
          onOpenMenu?.(e);
        }}
      >

        <Iconify icon="eva:more-vertical-fill" />
      </IconButton>
    </Box>
  );
}

// ----------------------------------------------------------------------

export function FileItemAvatar({ sharedUsers, sx, ...other }) {
  if (!sharedUsers?.length) {
    return null;
  }

  return (
    <AvatarGroup
      max={3}
      sx={[
        {
          display: 'inline-flex',
          [`& .${avatarGroupClasses.avatar}`]: {
            width: 24,
            height: 24,
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {sharedUsers.map((person) => (
        <Avatar key={person.id} alt={person.name} src={person.avatarUrl} />
      ))}
    </AvatarGroup>
  );
}
