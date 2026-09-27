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

import { AvisoSobreFoto } from './aviso-sobre-foto';

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
  avatarSize = 54,
  avatarBorderRadius = '50%',
  fallbackText = '?',
  lines = [],
  rightImage,
  // Texto del aviso de advertencia sobre la foto (vacío = sin aviso).
  avatarAviso = '',
  sx,
  ...other
}) {
  // Con la imagen en cache, el `load` del <img> llega antes de que React escuche
  // y el efecto de montaje la volvia a marcar "sin cargar": se quedaba
  // transparente hasta cambiar de vista otra vez. Se precarga aparte y el estado
  // guarda QUE url cargo, no un si/no que un montaje pueda pisar.
  const [urlCargada, setUrlCargada] = useState('');
  const initial = String(fallbackText || title || '?').charAt(0);
  const titleColor = disabled || isUnknownLabel(title) ? 'text.disabled' : 'inherit';
  const fotoVisible = Boolean(avatarUrl) && urlCargada === avatarUrl;

  useEffect(() => {
    if (!avatarUrl) return undefined;

    let vigente = true;
    const imagen = new Image();
    const marcarCargada = () => {
      if (vigente) setUrlCargada(avatarUrl);
    };

    imagen.onload = marcarCargada;
    imagen.src = avatarUrl;

    if (imagen.complete && imagen.naturalWidth > 0) marcarCargada();

    return () => {
      vigente = false;
      imagen.onload = null;
    };
  }, [avatarUrl]);

  const canUseHref = (hrefValue, textValue, allowWhenDisabled = false) => {
    if (disabled && !allowWhenDisabled) return false;

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

  // El título es la ficha misma: aunque se llame "Destacamento Desconocido 88"
  // existe y se puede abrir. La regla de "desconocido" es para las líneas
  // ("Coord. Desconocido"), que no llevan a ningún sitio.
  const puedeAbrirTitulo = !disabled && Boolean(href) && href !== '#';

  const isInternalHref = (hrefValue) => String(hrefValue || '').startsWith('/');
  const titleLinkProps = isInternalHref(href)
    ? { component: RouterLink, href }
    : { href };

  // Uno solo para las dos ramas: eran el mismo bloque duplicado.
  // El aviso va FUERA del Avatar (que recorta lo que sobresale), en una caja que
  // lo sostiene arriba a la derecha de la foto.
  const renderAvatar = () =>
    avatarAviso ? (
      <Box sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0, mr: 2 }}>
        {renderFoto({ mr: 0 })}
        <AvisoSobreFoto texto={avatarAviso} />
      </Box>
    ) : (
      renderFoto()
    );

  const renderFoto = (extraSx = {}) => (
    <Avatar
      alt={title}
      sx={{
        width: avatarSize,
        height: avatarSize,
        borderRadius: avatarBorderRadius,
        mr: 2,
        overflow: 'hidden',
        position: 'relative',
        ...extraSx,
      }}
    >
      <Box component="span">{initial}</Box>

      {!!avatarUrl && (
        <Box
          component="img"
          loading="lazy"
          decoding="async"
          alt={title}
          src={avatarUrl}
          onLoad={() => setUrlCargada(avatarUrl)}
          sx={{
            inset: 0,
            width: 1,
            height: 1,
            objectFit: 'cover',
            position: 'absolute',
            opacity: fotoVisible ? 1 : 0,
            transition: 'opacity 180ms ease',
          }}
        />
      )}
    </Avatar>
  );

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
      {puedeAbrirTitulo ? (
        <Link {...titleLinkProps} color="inherit" underline="none">
          {renderAvatar()}
        </Link>
      ) : (
        renderAvatar()
      )}

      <ListItemText
        primary={
          puedeAbrirTitulo ? (
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
            {lines.map((line, index) => (
              <Box
                key={`${line.icon ?? 'text'}-${line.text}-${index}`}
                component="span"
                sx={{
                  display: 'flex',
                  alignItems: line.wrap ? 'flex-start' : 'center',
                  minWidth: 0,
                  typography: 'caption',
                  color: 'text.disabled',
                }}
              >
                {line.icon && (
                  <Iconify icon={line.icon} width={16} sx={{ flexShrink: 0, mr: 0.5 }} />
                )}
                {canUseHref(line.href, line.text, line.allowWhenDisabled) ? (
                  <Link
                    {...(isInternalHref(line.href)
                      ? { component: RouterLink, href: line.href }
                      : { href: line.href })}
                    color="inherit"
                    underline="hover"
                    sx={
                      line.wrap
                        ? { whiteSpace: 'normal', overflowWrap: 'anywhere' }
                        : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                    }
                  >
                    {line.text}
                  </Link>
                ) : (
                  <Box
                    component="span"
                    sx={
                      line.wrap
                        ? { whiteSpace: 'normal', overflowWrap: 'anywhere' }
                        : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                    }
                  >
                    {line.text}
                  </Box>
                )}
                {/* Algo al final de la línea (p. ej. el estado del destacamento). */}
                {line.adorno && (
                  <Box component="span" sx={{ ml: 1, flexShrink: 0, display: 'inline-flex' }}>
                    {line.adorno}
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
          loading="lazy"
          decoding="async"
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
