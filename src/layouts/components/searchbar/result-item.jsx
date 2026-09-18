import { varAlpha, isExternalLink } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';

import { RouterLink } from 'src/routes/components';

import { Label } from 'src/components/label';

// ----------------------------------------------------------------------

export function ResultItem({
  title,
  path,
  labels,
  href,
  imagen = '',
  redonda = false,
  sx,
  ...other
}) {
  const linkProps = isExternalLink(href)
    ? { component: 'a', href, target: '_blank', rel: 'noopener noreferrer' }
    : { component: RouterLink, href };

  return (
    <ListItemButton
      {...linkProps}
      disableRipple
      sx={[
        (theme) => ({
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: 'transparent',
          borderBottomColor: theme.vars.palette.divider,
          '&:hover': {
            borderRadius: 1,
            borderColor: theme.vars.palette.primary.main,
            backgroundColor: varAlpha(
              theme.vars.palette.primary.mainChannel,
              theme.vars.palette.action.hoverOpacity
            ),
          },
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {/* LA CARA DEL RESULTADO. En los productos es una miniatura que viene
          DENTRO del catalogo (un `data:` de unos 2 kB), y en los premios un icono
          local: en los dos casos se pinta a la vez que el texto, sin pedir nada.
          Cuadrada y no redonda: son parches y articulos, no personas. */}
      {/* Personas y niveles van REDONDOS y siempre con cara: sin foto, la
          inicial de su nombre, para que la lista no salte de sangria. */}
      {(imagen || redonda) && (
        <Avatar
          variant={redonda ? 'circular' : 'rounded'}
          src={imagen || undefined}
          alt=""
          sx={{
            width: 32,
            height: 32,
            mr: 1.5,
            flexShrink: 0,
            typography: 'subtitle2',
            bgcolor: 'background.neutral',
            color: 'text.secondary',
          }}
          slotProps={{ img: { loading: 'lazy', decoding: 'async' } }}
        >
          {title
            .map((part) => part.text)
            .join('')
            .charAt(0)
            .toUpperCase()}
        </Avatar>
      )}

      <ListItemText
        primary={title.map((part, index) => (
          <Box
            key={index}
            component="span"
            sx={{
              ...(part.highlight && {
                color: 'primary.main',
              }),
            }}
          >
            {part.text}
          </Box>
        ))}
        secondary={path.map((part, index) => (
          <Box
            key={index}
            component="span"
            sx={{
              color: 'text.secondary',
              ...(part.highlight && {
                color: 'primary.main',
                fontWeight: 'fontWeightSemiBold',
              }),
            }}
          >
            {part.text}
          </Box>
        ))}
        slotProps={{
          secondary: {
            noWrap: true,
            sx: { typography: 'caption' },
          },
        }}
      />

      <Box sx={{ gap: 0.75, display: 'flex' }}>
        {[...labels].reverse().map((label) => (
          <Label key={label} color="default">
            {label}
          </Label>
        ))}
      </Box>
    </ListItemButton>
  );
}
