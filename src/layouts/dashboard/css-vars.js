import { varAlpha } from 'minimal-shared/utils';

import { bulletColor } from 'src/components/nav-section';

// ----------------------------------------------------------------------

export function dashboardLayoutVars(theme) {
  const {
    vars: { palette },
  } = theme;

  return {
    // LA BARRA DE ARRIBA, TAMBIEN NAVY.
    //
    // Era transparente y solo se teñia al bajar, con un velo del color del fondo.
    // Con la barra lateral y la portada en navy, esa franja clara entre las dos
    // partia la pantalla por la mitad justo donde la cabecera tiene que
    // continuar el escudo. Ahora es navy fija, en los dos modos, y forma una
    // sola pieza con la barra lateral.
    '--layout-header-bg': palette.brand.navy,
    '--layout-header-text': palette.common.white,
    // Lo de menos peso —iconos en reposo, textos de apoyo— en el mismo azulado
    // que usa la barra lateral, para que las dos hablen igual.
    '--layout-header-text-secondary': palette.grey[400],
    '--layout-transition-easing': 'linear',
    '--layout-transition-duration': '120ms',
    '--layout-nav-mini-width': '88px',
    '--layout-nav-vertical-width': '300px',
    '--layout-nav-horizontal-height': '64px',
    '--layout-dashboard-content-pt': theme.spacing(1),
    '--layout-dashboard-content-pb': theme.spacing(8),
    '--layout-dashboard-content-px': theme.spacing(5),
  };
}

// ----------------------------------------------------------------------

export function dashboardNavColorVars(theme, navColor = 'integrate', navLayout = 'vertical') {
  const {
    vars: { palette },
  } = theme;

  // EL NAVY DEL ESCUDO, DEL TEMA.
  //
  // Vivio un tiempo en un archivo de literales mientras se decidia el azul. Ahora
  // sale de `palette.brand` —los colores de marca, que no cambian con el preset—
  // y de `palette.primary`, que SI cambia: elegir otro acento en el engranaje
  // mueve tambien el item activo de la barra.
  //
  // La barra es navy en los DOS modos, claro y oscuro. No es una superficie que
  // siga al tema: es mobiliario de marca, como el escudo.
  const navy = palette.brand.navy;
  // El texto en reposo va azulado y no gris: un gris neutro sobre navy se ve
  // sucio. La escala del proyecto ya tiene ese sesgo.
  const textoEnReposo = palette.grey[400];
  // El velo del item abierto o con el raton encima: claro y translucido, para que
  // no compita con el relleno del activo.
  const velo = varAlpha(palette.common.whiteChannel, 0.08);

  switch (navColor) {
    // LOS DOS AJUSTES DAN LA MISMA BARRA.
    //
    // `integrate` la pintaba del color del fondo. Con la identidad nueva la barra
    // es navy siempre: es parte del escudo, no una superficie que se adapte. El
    // ajuste se conserva por lo que cada quien tenga guardado, pero ya no cambia
    // nada; si algun dia se quiere recuperar, aqui es donde se separa.
    case 'integrate':
    case 'apparent':
      return {
        layout: {
          '--layout-nav-bg': navy,
          '--layout-nav-horizontal-bg': varAlpha(palette.brand.navyChannel, 0.96),
          '--layout-nav-border-color': 'transparent',
          '--layout-nav-text-primary-color': palette.common.white,
          '--layout-nav-text-secondary-color': textoEnReposo,
          '--layout-nav-text-disabled-color': palette.grey[600],
        },
        section: {
          // caption
          '--nav-item-caption-color': palette.grey[600],
          // subheader: los rotulos de grupo (PRINCIPAL, ORGANIZACION...)
          '--nav-subheader-color': palette.grey[600],
          '--nav-subheader-hover-color': palette.common.white,
          // item
          '--nav-item-color': textoEnReposo,
          // El activo va RELLENO del color de la casa con texto blanco, no solo
          // coloreado: es lo que hace que se vea de un golpe donde estas.
          '--nav-item-root-active-color': palette.common.white,
          // LA MISMA EN OSCURO, Y HAY QUE DECIRLO. En modo oscuro el item activo
          // no lee la variable de arriba sino esta, que por defecto trae
          // `primary.light`: sin ponerla, el texto salia en el tono claro del
          // primario encima de su propio relleno.
          '--nav-item-root-active-color-on-dark': palette.common.white,
          '--nav-item-root-active-bg': palette.primary.main,
          '--nav-item-root-active-hover-bg': palette.primary.dark,
          '--nav-item-root-open-color': palette.common.white,
          '--nav-item-root-open-bg': velo,
          '--nav-item-hover-bg': velo,
          // bullet
          '--nav-bullet-light-color': bulletColor.dark,
          // sub
          ...(navLayout === 'vertical' && {
            '--nav-item-sub-active-color': palette.common.white,
            '--nav-item-sub-active-bg': velo,
            '--nav-item-sub-open-color': palette.common.white,
          }),
        },
      };
    default:
      throw new Error(`Invalid color: ${navColor}`);
  }
}
