import { varAlpha } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Rating from '@mui/material/Rating';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';

import { RouterLink } from 'src/routes/components';

import { fDopCurrency, fShortenNumber } from 'src/utils/format-number';

import { Label } from 'src/components/label';
import { Image } from 'src/components/image';
import { Iconify } from 'src/components/iconify';

import { etiquetaDeCategoria } from './product-table-row';

// ----------------------------------------------------------------------
// LA TARJETA DE LA TIENDA.
//
// Manda la FOTO: es lo que distingue una insignia de otra mucho antes que su
// nombre. Debajo, en este orden, lo que decide una compra: nombre, categoria,
// valoracion, precio y el carrito.
//
// SIN ETIQUETA DE INVENTARIO. Decia "En existencia" en casi todas las tarjetas
// —o sea, nada— y le robaba la linea a lo que si se mira antes de comprar. Que
// no queden existencias se sigue sabiendo: el carrito se apaga.
//
// SIN MENU DE TRES PUNTOS. Tapaba la esquina de la foto en todas las tarjetas
// para ofrecer lo que ya estaba a mano —ver la ficha es pulsar la tarjeta, y
// comprar es el boton del carrito—. Editar, publicar y eliminar siguen en la
// vista de panel, que es donde se administra la tienda.
//
// LAS ESTRELLAS SALEN DE LAS RESENAS REALES (`totalCalificaciones` y
// `totalResenas`, que escribe `product-review-service`). Sin resenas no se
// pinta media estrella: se dice que aun no hay valoraciones.
// ----------------------------------------------------------------------

// LA CINTA ROJA "NUEVO".
//
// La enciende quien gestiona la tienda desde la ficha del producto —crear o
// editar, "Mostrar cinta roja de nuevo en la tienda"— y se guarda en
// `etiquetaNuevo`. El texto es el que se escribio ahi; vacio, "Nuevo".
//
// Recortado a 12 caracteres tambien aqui y no solo en el formulario: la cinta
// mide lo que mide, y un texto largo guardado antes de ese tope se saldria por
// los dos lados.
const TEXTO_DE_CINTA_POR_DEFECTO = 'Nuevo';

const textoDeLaCinta = (product) => {
  if (!product?.newLabel?.enabled) return '';

  return (String(product.newLabel.content || '').trim() || TEXTO_DE_CINTA_POR_DEFECTO).slice(0, 12);
};

// ------------------------------------------------------------------
// PRUEBA LOCAL: LA CINTA "CASI AGOTADO".
//
// Para ver como se veria, en UN producto elegido por nombre y SOLO en
// desarrollo —`next build` la apaga—, asi que aunque se suba por descuido no
// sale en la tienda real. Si pisa a la de "Nuevo" es a proposito: es la que se
// quiere mirar.
//
// PARA QUITARLA: borrar este bloque y la linea `cintaDePrueba` del componente.
// ------------------------------------------------------------------
const CINTA_CASI_AGOTADO_DE_PRUEBA =
  process.env.NODE_ENV === 'development'
    ? {
        producto: 'correa nylon caqui',
        texto: 'Casi agotado',
        fondo: 'warning.main',
        tinta: 'grey.900',
      }
    : null;

const cintaDePruebaPara = (product) =>
  CINTA_CASI_AGOTADO_DE_PRUEBA &&
  String(product?.name || '')
    .trim()
    .toLowerCase()
    .startsWith(CINTA_CASI_AGOTADO_DE_PRUEBA.producto)
    ? CINTA_CASI_AGOTADO_DE_PRUEBA
    : null;

export function ProductGridCard({
  product,
  detailsHref,
  isMemberUser = false,
  canManageStore = false,
  onAddToCart,
}) {
  const available = Number(product.available ?? 0);
  const isPublished = product.publish === 'published';
  const esRestringido = product.renglon === 'restringido';
  const noRegistrado = Number(product.precioNoRegistrado ?? 0);
  const totalRatings = Number(product.totalRatings ?? 0);
  const totalReviews = Number(product.totalReviews ?? 0);
  const categoria = etiquetaDeCategoria(product.category);
  // SIN FOTO NO SE INVENTA UNA. Aqui se pedia prestada una de las tres de
  // demostracion de la plantilla mientras el catalogo real no tuviera las suyas,
  // y era mentira: tres productos distintos salian con la misma imagen y la
  // tienda parecia surtida. Sin foto va el marcador gris, que dice la verdad.
  const foto = product.coverUrl || '';

  const renderEstadosSobreLaFoto = () => (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ top: 8, left: 8, position: 'absolute', maxWidth: 'calc(100% - 16px)' }}
    >
      {/* BORRADOR ES ASUNTO DE QUIEN PUBLICA. Un producto sin publicar no llega
          al resto de la tienda, asi que la etiqueta solo la ve el gestor de la
          tienda y el Administrador Global. */}
      {canManageStore && !isPublished && (
        <Label variant="filled" color="default">
          Borrador
        </Label>
      )}

      {!isMemberUser && esRestringido && (
        <Label variant="filled" color="warning">
          Restringido
        </Label>
      )}
    </Stack>
  );

  // LAS ESTRELLAS SIEMPRE ESTAN, aunque nadie haya calificado: asi todas las
  // tarjetas miden lo mismo y la rejilla no baila. Sin resenas van apagadas
  // —cinco estrellas grises y un (0)—, que se distingue de un vistazo de un
  // producto bien valorado sin fingir una nota que nadie ha dado.
  const renderValoracion = () => {
    const sinResenas = totalReviews <= 0;

    return (
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Rating
          size="small"
          value={sinResenas ? 0 : totalRatings}
          precision={0.1}
          readOnly
          sx={{
            ...(sinResenas && {
              color: 'text.disabled',
              '& .MuiRating-iconEmpty': { color: 'text.disabled' },
            }),
          }}
        />

        <Box
          component="span"
          sx={{ typography: 'caption', color: sinResenas ? 'text.disabled' : 'text.secondary' }}
        >
          ({sinResenas ? 0 : fShortenNumber(totalReviews)})
        </Box>
      </Stack>
    );
  };

  // LOS DOS PRECIOS, UNO AL LADO DEL OTRO Y CON EL MISMO CUERPO DE LETRA. El de
  // no registrados va tachado, que es como se lee "este no es el tuyo" sin
  // gastar una linea en explicarlo. Ojo con el parecido: NO es una rebaja, son
  // dos publicos distintos —destacamentos registrados y los que no lo estan—,
  // y por eso el tachado es del mismo tamano que el precio y no mas pequeno.
  const renderPrecios = () =>
    isMemberUser ? (
      <Box component="span" sx={{ typography: 'h6' }}>
        {fDopCurrency(product.price)}
      </Box>
    ) : (
      <Stack direction="row" spacing={1} alignItems="baseline" sx={{ flexWrap: 'wrap' }}>
        <Box component="span" sx={{ typography: 'h6' }}>
          {fDopCurrency(product.precioRegistrado ?? product.price)}
        </Box>

        {noRegistrado > 0 && (
          <Tooltip title="Precio para destacamentos no registrados">
            <Box
              component="span"
              sx={{ typography: 'h6', color: 'text.disabled', textDecoration: 'line-through' }}
            >
              {fDopCurrency(noRegistrado)}
            </Box>
          </Tooltip>
        )}
      </Stack>
    );

  const textoNuevo = textoDeLaCinta(product);
  const cintaDePrueba = cintaDePruebaPara(product);
  const cinta =
    cintaDePrueba ||
    (textoNuevo ? { texto: textoNuevo, fondo: 'error.main', tinta: 'common.white' } : null);
  // Un texto de dos palabras necesita mas cinta: con la medida de "Nuevo",
  // "CASI AGOTADO" se cortaba por las dos puntas.
  const cintaLarga = (cinta?.texto || '').length > 6;

  // La cinta cruzada en la esquina de arriba a la derecha. Va dentro de una caja
  // que recorta: la banda es mas larga que la esquina a proposito, para que sus
  // dos puntas salgan por los bordes y se lea como una cinta y no como una
  // etiqueta girada.
  const renderCinta = () => (
    <Box
      sx={{
        top: 0,
        right: 0,
        width: cintaLarga ? 120 : 96,
        height: cintaLarga ? 120 : 96,
        overflow: 'hidden',
        position: 'absolute',
        pointerEvents: 'none',
      }}
    >
      <Box
        sx={{
          top: cintaLarga ? 26 : 18,
          right: cintaLarga ? -44 : -34,
          width: cintaLarga ? 180 : 140,
          py: 0.5,
          position: 'absolute',
          textAlign: 'center',
          transform: 'rotate(45deg)',
          typography: 'caption',
          fontWeight: 'fontWeightBold',
          letterSpacing: cintaLarga ? 0.25 : 0.5,
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
          color: cinta.tinta,
          bgcolor: cinta.fondo,
          boxShadow: (theme) => theme.vars.customShadows.z8,
        }}
      >
        {cinta.texto}
      </Box>
    </Box>
  );

  return (
    <Card
      sx={{
        height: 1,
        display: 'flex',
        flexDirection: 'column',
        transition: (theme) => theme.transitions.create(['box-shadow']),
        '&:hover': { boxShadow: (theme) => theme.shadows[8] },
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <Link component={RouterLink} href={detailsHref} sx={{ display: 'block' }}>
          {/* Sin foto no se pinta <Image>: pasarle src="" hacia que el navegador
                volviese a pedir la pagina entera y llenaba la consola de avisos.
                En su lugar va un marcador del mismo cuadrado, para que la rejilla
                no se descuadre cuando a un producto le falta la imagen. */}
          {foto ? (
            <Image alt={product.name} src={foto} ratio="1/1" sx={{ borderRadius: 0 }} />
          ) : (
            <Box
              sx={{
                aspectRatio: '1 / 1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.neutral',
                color: 'text.disabled',
              }}
            >
              <Iconify icon="solar:gallery-bold" width={40} />
            </Box>
          )}
        </Link>

        {renderEstadosSobreLaFoto()}

        {cinta && renderCinta()}

        {/* LA CATEGORIA, AL PIE DE LA FOTO Y A LA DERECHA. Debajo del nombre
              competia con el; aqui va pegada a lo que describe y le deja el
              cuerpo de la tarjeta al precio. Sin puntero: es una etiqueta, no
              un enlace, y detras esta el enlace a la ficha. */}
        {categoria && (
          <Box
            sx={{
              right: 8,
              bottom: 8,
              px: 0.75,
              py: 0.25,
              borderRadius: 0.75,
              position: 'absolute',
              pointerEvents: 'none',
              typography: 'caption',
              color: 'common.white',
              bgcolor: (theme) => varAlpha(theme.vars.palette.common.blackChannel, 0.64),
            }}
          >
            {categoria}
          </Box>
        )}
      </Box>

      <Stack spacing={0.5} sx={{ p: 2, flexGrow: 1 }}>
        <Link
          component={RouterLink}
          href={detailsHref}
          color="inherit"
          variant="subtitle2"
          sx={{
            display: '-webkit-box',
            overflow: 'hidden',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {product.name}
        </Link>

        <Box sx={{ flexGrow: 1 }} />

        {/* LO QUE CIERRA LA TARJETA: cuanto cuesta, como esta valorado y como
              se compra. Las estrellas van DEBAJO del precio —primero el numero
              que decide, despues la opinion ajena— y el carrito a la derecha,
              de pie sobre las dos lineas. Sin existencias se apaga en vez de
              desaparecer, para que la tarjeta no cambie de forma. */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Stack spacing={0.25} sx={{ minWidth: 0, flexGrow: 1 }}>
            {renderPrecios()}

            {renderValoracion()}
          </Stack>

          {!!onAddToCart && (
            <Tooltip title={available > 0 ? 'Agregar al carrito' : 'No disponible'}>
              <Box component="span" sx={{ flexShrink: 0 }}>
                <IconButton
                  color="primary"
                  aria-label="Agregar al carrito"
                  disabled={available <= 0}
                  onClick={() => onAddToCart?.(product)}
                  // MAS ANCHO QUE ALTO: un cuadrado del tamano de un icono se
                  // fallaba con el pulgar. Se ensancha sin crecer de alto para
                  // no empujar la fila del precio.
                  sx={{ px: 2, borderRadius: 1.25 }}
                >
                  <Iconify icon="solar:cart-plus-bold" />
                </IconButton>
              </Box>
            </Tooltip>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
