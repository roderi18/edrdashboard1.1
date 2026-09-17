import { varAlpha, mergeClasses } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import { styled } from '@mui/material/styles';

import { Logo } from 'src/components/logo';
import { Scrollbar } from 'src/components/scrollbar';
import { NavSectionMini, NavSectionVertical } from 'src/components/nav-section';

import { layoutClasses } from '../core';
import { NavUpgrade } from '../components/nav-upgrade';
import { NavToggleButton } from '../components/nav-toggle-button';

// ----------------------------------------------------------------------

export function NavVertical({
  sx,
  data,
  slots,
  cssVars,
  className,
  isNavMini,
  isNavLight,
  onToggleNav,
  checkPermissions,
  layoutQuery = 'md',
  ...other
}) {
  const renderNavVertical = () => (
    <>
      {slots?.topArea ?? (
        <Box sx={{ pl: 3.5, pt: 2.5, pb: 1 }}>
          <Box
            component="img"
            src={
              isNavLight
                ? '/logo/explora-wordmark.webp?v=2'
                : '/logo/explora-wordmark-light.webp?v=2'
            }
            alt="EXPLORA"
            width={190}
            height={40}
            loading="eager"
            decoding="sync"
            fetchPriority="high"
            sx={{
              width: 190,
              height: 40,
              display: 'block',
              objectFit: 'contain',
              objectPosition: 'left center',
            }}
          />
        </Box>
      )}

      <Scrollbar fillContent>
        <NavSectionVertical
          data={data}
          cssVars={cssVars}
          checkPermissions={checkPermissions}
          sx={{ px: 2, flex: '1 1 auto' }}
        />

        {slots?.bottomArea ?? <NavUpgrade />}
      </Scrollbar>
    </>
  );

  const renderNavMini = () => (
    <>
      {slots?.topArea ?? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2.5 }}>
          <Logo />
        </Box>
      )}

      <NavSectionMini
        data={data}
        cssVars={cssVars}
        checkPermissions={checkPermissions}
        sx={[
          (theme) => ({
            ...theme.mixins.hideScrollY,
            pb: 2,
            px: 0.5,
            flex: '1 1 auto',
            overflowY: 'auto',
          }),
        ]}
      />

      {slots?.bottomArea}
    </>
  );

  return (
    <NavRoot
      isNavMini={isNavMini}
      layoutQuery={layoutQuery}
      className={mergeClasses([layoutClasses.nav.root, layoutClasses.nav.vertical, className])}
      sx={sx}
      {...other}
    >
      <NavToggleButton
        isNavMini={isNavMini}
        onClick={onToggleNav}
        sx={[
          (theme) => ({
            display: 'none',
            [theme.breakpoints.up(layoutQuery)]: { display: 'inline-flex' },
          }),
        ]}
      />
      {isNavMini ? renderNavMini() : renderNavVertical()}
    </NavRoot>
  );
}

// ----------------------------------------------------------------------
// LA CORDILLERA DEL PIE DE LA BARRA.
//
// Dos crestas: la de atras mas alta y mas tenue, la de delante mas baja y algo
// mas marcada. Con una sola quedaba un triangulo pegado abajo; con dos hay
// profundidad y se lee como un paisaje aunque apenas se vea.
//
// Va en `currentColor` blanco y la opacidad se pone desde el CSS: asi el mismo
// dibujo sirve si manana el pie cambia de fondo.
//
// Dibujada a mano y no traida de un archivo para que viaje con el componente: es
// decoracion de una barra concreta, no un recurso del proyecto, y un `.svg` en
// `public/` habria que acordarse de borrarlo el dia que esto se quite.
const CORDILLERA = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 160' preserveAspectRatio='none'>
  <path fill='%23ffffff' fill-opacity='.45' d='M0 160V88l38-32 32 26 38-44 38 46 38-26 38 38 36-30 42 32v62z'/>
  <path fill='%23ffffff' fill-opacity='.85' d='M0 160v-38l44-28 38 24 42-32 40 38 38-22 44 32 54-26v52z'/>
</svg>`;

const NavRoot = styled('div', {
  shouldForwardProp: (prop) => !['isNavMini', 'layoutQuery', 'sx'].includes(prop),
})(({ isNavMini, layoutQuery = 'md', theme }) => ({
  top: 0,
  left: 0,
  height: '100%',
  display: 'none',
  position: 'fixed',
  flexDirection: 'column',
  zIndex: 'var(--layout-nav-zIndex)',
  backgroundColor: 'var(--layout-nav-bg)',
  // El degradado —navy arriba, azul abierto abajo— se declara en `css-vars.js`
  // junto al resto de los colores de la barra: asi el ajuste "Barra en blanco"
  // puede apagarlo poniendo la variable en `none`, y aqui no hay que saber nada
  // de ajustes. El color de debajo se queda de respaldo.
  backgroundImage: 'var(--layout-nav-bg-image, none)',
  width: isNavMini ? 'var(--layout-nav-mini-width)' : 'var(--layout-nav-vertical-width)',
  borderRight: `1px solid var(--layout-nav-border-color, ${varAlpha(theme.vars.palette.grey['500Channel'], 0.12)})`,
  transition: theme.transitions.create(['width'], {
    easing: 'var(--layout-transition-easing)',
    duration: 'var(--layout-transition-duration)',
  }),
  [theme.breakpoints.up(layoutQuery)]: { display: 'flex' },

  // EL DIBUJO POR DETRAS, SIN TOCAR A LOS HIJOS.
  //
  // Aqui habia un `& > *` que les ponia `position: relative` para levantarlos por
  // encima del pseudo-elemento. Se llevo por delante el boton de plegar la barra,
  // que es hijo directo y va `absolute`: al pisarle la posicion salia del flujo
  // normal y se estiraba a lo ancho de la barra.
  //
  // Con `isolate` la barra crea su propio contexto de apilado, y dentro de el un
  // `z-index: -1` deja el dibujo por encima del fondo y por debajo de todo lo
  // demas, sin que ningun hijo tenga que enterarse.
  isolation: 'isolate',

  // EN LA BARRA ANCHA Y SOLO AHI. En la version mini son 88 pixeles: un paisaje
  // recortado a esa anchura no se lee como un paisaje, se lee como un borron.
  ...(!isNavMini && {
    '&::after': {
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: -1,
      height: 168,
      content: '""',
      opacity: 0.06,
      position: 'absolute',
      pointerEvents: 'none',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'bottom center',
      backgroundSize: '100% 168px',
      backgroundImage: `url("data:image/svg+xml;charset=utf-8,${CORDILLERA.replace(/\n\s*/g, '')}")`,
    },
  }),
}));
