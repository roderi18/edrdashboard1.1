import { memo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Avatar from '@mui/material/Avatar';
import Skeleton from '@mui/material/Skeleton';
import ListItemText from '@mui/material/ListItemText';

import { RouterLink } from 'src/routes/components';

import { isUnknownLabel } from 'src/utils/is-unknown-label';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export function CompactEntityCardSkeleton() {
  return (
    <Card
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        minHeight: 88,
        p: theme.spacing(3, 2, 3, 3),
      })}
    >
      <Skeleton variant="circular" width={48} height={48} sx={{ flexShrink: 0, mr: 2 }} />
      <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
        <Skeleton variant="text" width="52%" height={24} />
        <Skeleton variant="text" width="42%" height={18} />
        <Skeleton variant="text" width="56%" height={18} />
      </Box>
    </Card>
  );
}

export const CompactEntityCard = memo(function CompactEntityCard({
  title,
  href = '#',
  disabled = false,
  avatarUrl = '',
  fallbackText = '?',
  lines = [],
  rightImage,
  sx,
  ...other
}) {
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const initial = String(fallbackText || title || '?').charAt(0);
  const titleColor = disabled || isUnknownLabel(title) ? 'text.disabled' : 'inherit';

  useEffect(() => {
    setAvatarLoaded(false);
  }, [avatarUrl]);

  const canUseHref = (hrefValue, textValue) => {
    if (disabled) return false;

    const normalizedText = String(textValue ?? '')
      .trim()
      .toLowerCase();

    return (
      Boolean(hrefValue) &&
      hrefValue !== '#' &&
      normalizedText &&
      normalizedText !== '-' &&
      normalizedText !== 'n/a' &&
      !isUnknownLabel(textValue)
    );
  };

  const isInternalHref = (hrefValue) => String(hrefValue || '').startsWith('/');
  const titleLinkProps = isInternalHref(href)
    ? { component: RouterLink, href }
    : { href };

  return (
    <Card
      sx={[
        (theme) => ({
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          minHeight: 88,
          p: theme.spacing(3, rightImage ? 8 : 2, 3, 3),
          ...(disabled && { opacity: 0.72, cursor: 'default' }),
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...other}
    >
      {canUseHref(href, title) ? (
        <Link {...titleLinkProps} color="inherit" underline="none">
          <Avatar
            alt={title}
            sx={{
              width: 48,
              height: 48,
              mr: 2,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <Box component="span">{initial}</Box>
            {avatarUrl && (
              <Box
                component="img"
                alt={title}
                src={avatarUrl}
                onLoad={() => setAvatarLoaded(true)}
                sx={{
                  inset: 0,
                  width: 1,
                  height: 1,
                  objectFit: 'cover',
                  position: 'absolute',
                  opacity: avatarLoaded ? 1 : 0,
                  transition: 'opacity 180ms ease',
                }}
              />
            )}
          </Avatar>
        </Link>
      ) : (
        <Avatar
          alt={title}
          sx={{
            width: 48,
            height: 48,
            mr: 2,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Box component="span">{initial}</Box>
          {avatarUrl && (
            <Box
              component="img"
              alt={title}
              src={avatarUrl}
              onLoad={() => setAvatarLoaded(true)}
              sx={{
                inset: 0,
                width: 1,
                height: 1,
                objectFit: 'cover',
                position: 'absolute',
                opacity: avatarLoaded ? 1 : 0,
                transition: 'opacity 180ms ease',
              }}
            />
          )}
        </Avatar>
      )}

      <ListItemText
        primary={
          canUseHref(href, title) ? (
            <Link
              {...titleLinkProps}
              color="inherit"
              underline="hover"
              sx={{ color: titleColor }}
            >
              {title}
            </Link>
          ) : (
            <Box component="span" sx={{ color: titleColor }}>
              {title}
            </Box>
          )
        }
        secondary={
          <Box component="span" sx={{ display: 'grid', gap: 0.35, minWidth: 0 }}>
            {lines.map((line) => (
              <Box
                key={`${line.icon}-${line.text}`}
                component="span"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  minWidth: 0,
                  typography: 'caption',
                  color: 'text.disabled',
                }}
              >
                {line.icon && (
                  <Iconify icon={line.icon} width={16} sx={{ flexShrink: 0, mr: 0.5 }} />
                )}
                {canUseHref(line.href, line.text) ? (
                  <Link
                    {...(isInternalHref(line.href)
                      ? { component: RouterLink, href: line.href }
                      : { href: line.href })}
                    color="inherit"
                    underline="hover"
                    sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {line.text}
                  </Link>
                ) : (
                  <Box
                    component="span"
                    sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {line.text}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        }
        slotProps={{
          primary: { noWrap: true },
          secondary: { component: 'span', sx: { mt: 0.5, display: 'block' } },
        }}
      />

      {rightImage && (
        <Box
          component="img"
          alt={rightImage.alt}
          src={rightImage.src}
          sx={{
            right: 18,
            bottom: 16,
            width: 42,
            height: 42,
            objectFit: 'contain',
            position: 'absolute',
            pointerEvents: 'none',
          }}
        />
      )}
    </Card>
  );
});
