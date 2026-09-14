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

// LA CINTA ROJA "RECIÉN AGREGADO".
//
// La enciende quien gestiona la tienda desde la ficha del producto —crear o
// editar, "Mostrar cinta roja de nuevo en la tienda"— y se guarda en
// `etiquetaNuevo`. El texto es el que se escribio ahi; vacio, "Recién agregado".
//
// Vacio decia "Nuevo". Se cambio porque es lo que se quiere leer en la tienda
// cuando algo acaba de entrar, y asi no hay que escribirlo a mano en cada
// producto. Por eso el campo sigue llamandose `etiquetaNuevo`: renombrarlo
// dejaria sin cinta a los productos que ya la tienen guardada.
//
// Recortado tambien aqui y no solo en el formulario: la cinta mide lo que mide,
// y un texto largo guardado antes de ese tope se saldria por los dos lados. Era
// 12 y "Recién agregado" salia como "RECIÉN AGREG"; con 16 cabe, y la cinta de
// los textos mas largos va mas metida en la foto (ver `MEDIDAS_DE_CINTA`).
const TEXTO_DE_CINTA_POR_DEFECTO = 'Recién agregado';
const TOPE_DE_TEXTO_DE_CINTA = 16;

const textoDeLaCinta = (product) => {
  if (!product?.newLabel?.enabled) return '';

  return (String(product.newLabel.content || '').trim() || TEXTO_DE_CINTA_POR_DEFECTO).slice(
    0,
    TOPE_DE_TEXTO_DE_CINTA
  );
};

// LA CINTA CRECE CON SU TEXTO, METIENDOSE EN LA FOTO.
//
// Cruza la esquina en diagonal, asi que el hueco que le queda al texto es el
// ancho de la foto a la altura de la cinta: cuanto mas lejos de la esquina, mas
// ancho. Por eso un texto largo no pide una cinta mas larga —las puntas ya se
// salen—, pide una cinta MAS ADENTRO. `caja` es el cuadrado que recorta; `arriba`
// y `derecha` colocan la banda dentro de el.
const MEDIDAS_DE_CINTA = [
  // Los cortos que se escriban a mano, como "Nuevo" u "Oferta".
  { hasta: 6, caja: 96, ancho: 140, arriba: 18, derecha: -34, espacio: 0.5 },
  // "Casi agotado" y "Recién agregado", EN EL MISMO SITIO. Tenian cada una su
  // medida y, puestas una al lado de la otra en la rejilla, las cintas de dos
  // palabras quedaban a alturas distintas. La de "Recién agregado" es la que
  // cabe entera, asi que es la que manda para todas las largas.
  { hasta: Infinity, caja: 160, ancho: 220, arriba: 42, derecha: -50, espacio: 0.25 },
];

const medidasDeCinta = (texto = '') =>
  MEDIDAS_DE_CINTA.find((medida) => texto.length <= medida.hasta);

// ------------------------------------------------------------------
// PRUEBA LOCAL: CINTAS DE EXISTENCIAS.
//
// Para ver como se verian, en productos elegidos por nombre y SOLO en
// desarrollo —`next build` las apaga—, asi que aunque se suban por descuido no
// salen en la tienda real. Si pisan a la de "Recién agregado" es a proposito:
// son las que se quieren mirar.
//
// Una lista y no una constante suelta: con la segunda cinta de prueba copiar el
// bloque entero habria dejado dos funciones casi iguales.
//
// PARA QUITARLAS: borrar este bloque y la linea `cintaDePrueba` del componente.
// ------------------------------------------------------------------
const CINTAS_DE_PRUEBA =
  process.env.NODE_ENV === 'development'
    ? [
        {
          producto: 'correa nylon caqui',
          texto: 'Pocas existencias',
          fondo: 'warning.main',
          // Blanco, como la de "Recién agregado": las cintas se leen como una
          // misma pieza.
          tinta: 'common.white',
        },
        {
          producto: 'libro convirtiéndose en un hombre de dios',
          texto: 'Agotado',
          // Gris oscuro y no rojo: el rojo ya es "Recién agregado", y un agotado
          // no invita a nada; tiene que leerse como apagado.
          fondo: 'grey.800',
          tinta: 'common.white',
        },
      ]
    : [];

const cintaDePruebaPara = (product) => {
  const nombre = String(product?.name || '')
    .trim()
    .toLowerCase();

  return CINTAS_DE_PRUEBA.find((cinta) => nombre.startsWith(cinta.producto)) || null;
};

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
  // "AGOTADO" VA EN GRIS. La cinta es una sola y el texto lo escribe quien
  // gestiona la tienda; en rojo, un agotado se leia como una novedad —el rojo es
  // "Recién agregado"— e invitaba a pulsar algo que no se puede comprar.
  const esAgotado = textoNuevo.trim().toLowerCase() === 'agotado';
  const cinta =
    cintaDePrueba ||
    (textoNuevo
      ? {
          texto: textoNuevo,
          fondo: esAgotado ? 'grey.800' : 'error.main',
          tinta: 'common.white',
        }
      : null);
  const medidas = medidasDeCinta(cinta?.texto);

  // La cinta cruzada en la esquina de arriba a la derecha. Va dentro de una caja
  // que recorta: la banda es mas larga que la esquina a proposito, para que sus
  // dos puntas salgan por los bordes y se lea como una cinta y no como una
  // etiqueta girada.
  const renderCinta = () => (
    <Box
      sx={{
        top: 0,
        right: 0,
        width: medidas.caja,
        height: medidas.caja,
        overflow: 'hidden',
        position: 'absolute',
        pointerEvents: 'none',
      }}
    >
      <Box
        sx={{
          top: medidas.arriba,
          right: medidas.derecha,
          width: medidas.ancho,
          py: 0.5,
          position: 'absolute',
          textAlign: 'center',
          transform: 'rotate(45deg)',
          typography: 'caption',
          fontWeight: 'fontWeightBold',
          letterSpacing: medidas.espacio,
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
