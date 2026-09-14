import { varAlpha } from 'minimal-shared/utils';

import { bulletColor } from 'src/components/nav-section';

// ----------------------------------------------------------------------

/**
 * Las variables de la cabecera.
 *
 * `enBlanco` la devuelve al aspecto de la plantilla —fondo del color del
 * contenido y textos de la escala normal—, que es lo que enciende el interruptor
 * "Barra en blanco" del panel de ajustes. Por defecto va en navy.
 */
export function dashboardLayoutVars(theme, enBlanco = false) {
  const {
    vars: { palette },
  } = theme;

  // LA BARRA DE ARRIBA, NAVY.
  //
  // Era transparente y solo se teñia al bajar, con un velo del color del fondo.
  // Con la barra lateral y la portada en navy, esa franja clara entre las dos
  // partia la pantalla por la mitad justo donde la cabecera tiene que continuar
  // el escudo.
  //
  // El fade va de izquierda a derecha: navy donde arranca —pegada a la barra
  // lateral, que empieza en ese mismo tono, asi la esquina de arriba no tiene
  // juntura— y `navyLight` al llegar a la derecha, donde estan la cuenta y los
  // avisos.
  //
  // Con las MISMAS paradas que el fade de la barra lateral, girado 90 grados:
  // navy fijo hasta el 60% y solo entonces aclara. Iba de 0 a 100 de corrido y
  // la cabecera empezaba a lavarse ya a la altura del buscador, mientras la
  // barra lateral aguantaba el navy; las dos no se leian como la misma pieza.
  //
  // En blanco no hay degradado: un fade sobre el color del contenido se lee como
  // una mancha, no como una cabecera.
  const cabecera = enBlanco
    ? {
        '--layout-header-bg': palette.background.default,
        '--layout-header-bg-image': 'none',
        '--layout-header-text': palette.text.primary,
        '--layout-header-text-secondary': palette.text.secondary,
      }
    : {
        '--layout-header-bg': palette.brand.navy,
        '--layout-header-bg-image': `linear-gradient(90deg, ${palette.brand.navy} 0%, ${palette.brand.navy} 60%, ${palette.brand.navyLight} 100%)`,
        '--layout-header-text': palette.common.white,
        // Lo de menos peso —iconos en reposo, textos de apoyo— en el mismo
        // azulado que usa la barra lateral, para que las dos hablen igual.
        '--layout-header-text-secondary': palette.grey[400],
      };

  return {
    ...cabecera,
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

/**
 * Las variables de la barra lateral.
 *
 * `enBlanco` la devuelve al aspecto de la plantilla: fondo del color del
 * contenido, textos de la escala normal y el item activo coloreado en vez de
 * relleno. Es lo que enciende "Barra en blanco" en el panel de ajustes.
 */
export function dashboardNavColorVars(
  theme,
  navColor = 'integrate',
  navLayout = 'vertical',
  enBlanco = false
) {
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

  // LA BARRA EN BLANCO, COMO LA PLANTILLA.
  //
  // Sale antes del `switch` porque no depende del ajuste de color de la barra:
  // es un si o un no, y cuando es que si manda sobre los dos.
  //
  // El item activo va COLOREADO y no relleno: sobre un fondo claro el relleno del
  // primario es un bloque de color macizo en medio de la lista, y con seis grupos
  // de botones eso pesa demasiado. El velo del primario basta para señalar donde
  // estas.
  if (enBlanco) {
    const veloDelPrimario = varAlpha(palette.primary.mainChannel, 0.08);

    return {
      layout: {
        '--layout-nav-bg': palette.background.default,
        '--layout-nav-bg-image': 'none',
        '--layout-nav-horizontal-bg': varAlpha(palette.background.defaultChannel, 0.96),
        '--layout-nav-border-color': varAlpha(palette.grey['500Channel'], 0.12),
        '--layout-nav-text-primary-color': palette.text.primary,
        '--layout-nav-text-secondary-color': palette.text.secondary,
        '--layout-nav-text-disabled-color': palette.text.disabled,
      },
      section: {
        '--nav-item-caption-color': palette.text.disabled,
        '--nav-subheader-color': palette.text.disabled,
        '--nav-subheader-hover-color': palette.text.primary,
        '--nav-item-color': palette.text.secondary,
        '--nav-item-root-active-color': palette.primary.main,
        // En oscuro el item activo lee ESTA y no la de arriba; sin ponerla sale
        // con el primario de modo claro sobre un fondo oscuro.
        '--nav-item-root-active-color-on-dark': palette.primary.light,
        '--nav-item-root-active-bg': veloDelPrimario,
        '--nav-item-root-active-hover-bg': varAlpha(palette.primary.mainChannel, 0.16),
        '--nav-item-root-open-color': palette.text.primary,
        '--nav-item-root-open-bg': varAlpha(palette.grey['500Channel'], 0.08),
        '--nav-item-hover-bg': varAlpha(palette.grey['500Channel'], 0.08),
        '--nav-bullet-light-color': bulletColor.light,
        ...(navLayout === 'vertical' && {
          '--nav-item-sub-active-color': palette.text.primary,
          '--nav-item-sub-active-bg': varAlpha(palette.grey['500Channel'], 0.08),
          '--nav-item-sub-open-color': palette.text.primary,
        }),
      },
    };
  }

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
          // EL FADE VERTICAL DE LA BARRA: navy arriba, azul abierto abajo. Va en
          // variable y no en el componente para que la barra en blanco pueda
          // apagarlo con un `none`, sin que el componente sepa de ajustes.
          //
          // Mas cerrado de lo que fue: terminaba en `navyLighter` y el pie de la
          // barra se leia gris-azulado, casi lavado. Ahora el navy aguanta hasta
          // el 60% —los grupos de botones quedan todos sobre el tono de la casa—
          // y solo aclara hasta `navyLight` al final.
          //
          // Arriba sigue en `navy`, NO en `navyDark`: la cabecera arranca en ese
          // mismo tono y se tocan en la esquina; oscurecer el arranque abria ahi
          // una juntura.
          '--layout-nav-bg-image': `linear-gradient(180deg, ${navy} 0%, ${navy} 60%, ${palette.brand.navyLight} 100%)`,
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
