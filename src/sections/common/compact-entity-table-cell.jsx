import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import TableCell from '@mui/material/TableCell';

import { RouterLink } from 'src/routes/components';

import { isUnknownLabel } from 'src/utils/is-unknown-label';

import { AvisoSobreFoto } from './aviso-sobre-foto';

// ----------------------------------------------------------------------

export function CompactEntityTableCell({
  title,
  href,
  subtitle,
  subtitleHref,
  avatarUrl,
  avatarAlt,
  avatarChildren,
  onAvatarClick,
  linkUnderline = 'always',
  linkSx,
  avatarSx,
  cellSx,
  // Texto del aviso de advertencia sobre la foto (vacío = sin aviso).
  avatarAviso = '',
  // Algo más debajo del subtítulo (p. ej. el estado del destacamento).
  extra = null,
}) {
  const hasHref = Boolean(href);
  const titleSx = {
    ...linkSx,
    ...(isUnknownLabel(title) && { color: 'text.disabled' }),
  };

  return (
    <TableCell sx={cellSx}>
      <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
        <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
          <Avatar
            alt={avatarAlt || title}
            src={avatarUrl || undefined}
            onClick={onAvatarClick}
            sx={{
              ...(onAvatarClick && { cursor: 'pointer' }),
              ...avatarSx,
            }}
          >
            {avatarChildren}
          </Avatar>

          <AvisoSobreFoto texto={avatarAviso} size={18} />
        </Box>

        <Stack sx={{ typography: 'body2', flex: '1 1 auto', alignItems: 'flex-start' }}>
          {hasHref ? (
            <Link
              component={RouterLink}
              href={href}
              color="inherit"
              underline={linkUnderline}
              sx={{ cursor: 'pointer', ...titleSx }}
            >
              {title}
            </Link>
          ) : (
            <Box component="span" sx={titleSx}>
              {title}
            </Box>
          )}

          {subtitle !== undefined &&
            (subtitleHref ? (
              <Link
                href={subtitleHref}
                color="inherit"
                underline="hover"
                sx={{ color: 'text.disabled' }}
              >
                {subtitle}
              </Link>
            ) : (
              <Box component="span" sx={{ color: 'text.disabled' }}>
                {subtitle}
              </Box>
            ))}

          {extra}
        </Stack>
      </Box>
    </TableCell>
  );
}
