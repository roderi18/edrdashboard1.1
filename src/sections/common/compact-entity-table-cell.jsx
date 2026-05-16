import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import TableCell from '@mui/material/TableCell';

import { RouterLink } from 'src/routes/components';

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
}) {
  const hasHref = Boolean(href);

  return (
    <TableCell sx={cellSx}>
      <Box sx={{ gap: 2, display: 'flex', alignItems: 'center' }}>
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

        <Stack sx={{ typography: 'body2', flex: '1 1 auto', alignItems: 'flex-start' }}>
          {hasHref ? (
            <Link
              component={RouterLink}
              href={href}
              color="inherit"
              underline={linkUnderline}
              sx={{ cursor: 'pointer', ...linkSx }}
            >
              {title}
            </Link>
          ) : (
            <Box component="span" sx={linkSx}>
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
        </Stack>
      </Box>
    </TableCell>
  );
}
