'use client';

import Cropper from 'react-easy-crop';
import { useRef, useState, useEffect, useCallback, useImperativeHandle } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

import { ANCHO_DE_REFERENCIA } from 'src/utils/store-header-design.mjs';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// LA FOTO DE LA PORTADA DE LA TIENDA, ENCUADRADA EN SU PROPIO SITIO.
//
// El encuadre NO abre otro dialogo. La foto se mueve y se acerca dentro del
// MISMO recuadro donde luego se va a ver, que es la unica forma de saber que
// parte queda dentro: con un dialogo aparte se elegia sobre un cuadrado y
// despues la portada la recortaba a lo ancho por su cuenta.
//
// UN SOLO GUARDAR, el del dialogo. El recuadro tenia los suyos propios y
// quedaban dos botones con el mismo nombre en la misma pantalla: nadie sabia
// cual guardaba que, y encuadrar sin pulsar el de arriba perdia el recorte sin
// avisar. Ahora el encuadre se confirma solo cuando se guarda el encabezado
// —`confirmarEncuadre`, que el dialogo llama antes de subir— y cancelar el
// dialogo lo descarta, como descarta todo lo demas.
// ----------------------------------------------------------------------

// EL RECUADRO MIDE LO QUE MIDE EL ENCABEZADO, MEDIDO EN PANTALLA.
//
// Primero se encuadraba sobre una franja 16:5 fija; despues, sobre el ancho con
// el que se diseña (1200) y el alto guardado. Las dos se equivocaban por lo
// mismo: la portada ocupa el ancho de VERDAD del navegador —1450 px en un
// monitor, 380 en un telefono— y su alto depende de lo que lleve dentro. Con una
// proporcion supuesta, el recorte salia mas alto o mas bajo de lo que se veia.
//
// Asi que el dialogo pregunta al encabezado cuanto mide (`proporcionMedida`) y
// encuadra sobre eso. Si aun no se ha medido —el primer pintado—, se cae al
// lienzo de referencia, que es mejor que no pintar nada.
const ANCHO = 1600;

// CUANTO SE ESTIRA HACIA ABAJO EL RECUADRO DEL DIALOGO.
//
// 1 es la forma exacta de la portada. Por encima, el recuadro se hace mas alto
// SIN tocar el ancho: se ve un poco mas de foto por arriba y por abajo de lo que
// entrara en el encabezado, que es comodo para colocar, y el ancho —los angulos
// que tanto costo cuadrar— se queda igual.
//
// Solo afecta a lo que se VE en el dialogo: el recorte que se guarda lo sigue
// decidiendo `aspect`, que lleva la proporcion del encabezado de verdad.
const ESTIRADO_VERTICAL = 1.3;

const proporcionDe = (altura, medida) =>
  medida > 0 ? medida : ANCHO_DE_REFERENCIA / Math.max(1, Number(altura) || 1);

/** La porcion elegida, dibujada a tamaño util y en WebP. */
const recortar = async (origen, area, alto) => {
  const imagen = await new Promise((resolve, reject) => {
    const elemento = new Image();
    elemento.addEventListener('load', () => resolve(elemento));
    elemento.addEventListener('error', reject);
    elemento.src = origen;
  });

  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO;
  lienzo.height = alto;

  const contexto = lienzo.getContext('2d');
  if (!contexto) throw new Error('No se pudo preparar el recorte.');

  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = 'high';
  contexto.drawImage(imagen, area.x, area.y, area.width, area.height, 0, 0, ANCHO, alto);

  const blob = await new Promise((resolve) => lienzo.toBlob(resolve, 'image/webp', 0.9));
  if (!blob) throw new Error('No se pudo preparar el recorte.');

  return blob;
};

/** La foto entera, encajada en la proporcion del encabezado. */
const areaCompleta = async (origen, alto) => {
  const imagen = await new Promise((resolve, reject) => {
    const elemento = new Image();
    elemento.addEventListener('load', () => resolve(elemento));
    elemento.addEventListener('error', reject);
    elemento.src = origen;
  });

  const proporcion = ANCHO / alto;
  const anchoUtil = Math.min(imagen.width, imagen.height * proporcion);
  const altoUtil = anchoUtil / proporcion;

  return {
    x: (imagen.width - anchoUtil) / 2,
    y: (imagen.height - altoUtil) / 2,
    width: anchoUtil,
    height: altoUtil,
  };
};

export function StoreHeaderPhoto({
  ref,
  vistaPrevia,
  onCambiar,
  superposicion,
  altura = 200,
  medidaPortada = null,
  deshabilitado = false,
}) {
  const marcoRef = useRef(null);
  const [anchoDelMarco, setAnchoDelMarco] = useState(0);

  const proporcionMedida =
    medidaPortada?.ancho > 0 && medidaPortada?.alto > 0
      ? medidaPortada.ancho / medidaPortada.alto
      : 0;

  const proporcion = proporcionDe(altura, proporcionMedida);

  // CUANTO SE ENCOGE LA PORTADA PARA CABER EN EL RECUADRO. El recuadro tiene su
  // forma pero no su tamaño, asi que la maqueta se reduce en esa misma medida:
  // todo —el escudo, el titulo, el lema y las distancias— baja a la vez.
  const escala =
    medidaPortada?.ancho > 0 && anchoDelMarco > 0 ? anchoDelMarco / medidaPortada.ancho : 0;

  useEffect(() => {
    const nodo = marcoRef.current;

    if (!nodo || typeof ResizeObserver === 'undefined') return undefined;

    setAnchoDelMarco(nodo.getBoundingClientRect().width);

    const vigilante = new ResizeObserver(([entrada]) =>
      setAnchoDelMarco(entrada.contentRect.width)
    );

    vigilante.observe(nodo);

    return () => vigilante.disconnect();
  }, []);

  const alto = Math.round(ANCHO / proporcion);

  const [porEncuadrar, setPorEncuadrar] = useState(null);
  const [origen, setOrigen] = useState(null);
  const [posicion, setPosicion] = useState({ x: 0, y: 0 });
  const [acercamiento, setAcercamiento] = useState(1);
  const [area, setArea] = useState(null);
  const [error, setError] = useState(null);

  // El archivo llega como objeto: se convierte en algo que se pueda pintar, y se
  // suelta al terminar para no dejar la memoria ocupada.
  useEffect(() => {
    if (!porEncuadrar) return undefined;

    const url = URL.createObjectURL(porEncuadrar);
    setOrigen(url);

    return () => URL.revokeObjectURL(url);
  }, [porEncuadrar]);

  const limpiarEncuadre = useCallback(() => {
    setPorEncuadrar(null);
    setOrigen(null);
    setPosicion({ x: 0, y: 0 });
    setAcercamiento(1);
    setArea(null);
    setError(null);
  }, []);

  const handleElegirArchivo = useCallback((evento) => {
    const archivo = evento.target.files?.[0];

    if (!archivo) return;

    if (!archivo.type?.startsWith('image/')) {
      setError('Ese archivo no es una imagen.');

      return;
    }

    setError(null);
    setPorEncuadrar(archivo);
  }, []);

  /**
   * Cierra el encuadre en curso y devuelve la foto recortada.
   *
   * Lo llama el dialogo justo antes de subir: si hay algo a medio encuadrar, se
   * queda con lo que se ve; si no hay nada, devuelve `null` y el dialogo sigue
   * su camino con la foto que ya hubiera.
   */
  const confirmarEncuadre = useCallback(async () => {
    if (!origen) return null;

    try {
      // Si el recortador aun no ha dicho que area hay elegida —pasa cuando se
      // guarda sin haber tocado nada—, se usa la foto entera en vez de no hacer
      // nada. Un boton que no responde y no explica por que es peor que un
      // encuadre por defecto.
      const zona = area ?? (await areaCompleta(origen, alto));
      const blob = await recortar(origen, zona, alto);
      const nombre = String(porEncuadrar?.name || 'portada').replace(/\.[^.]+$/, '');
      const recortada = new File([blob], `${nombre}.webp`, {
        type: 'image/webp',
        lastModified: Date.now(),
      });

      onCambiar?.(recortada, URL.createObjectURL(recortada));
      limpiarEncuadre();

      return recortada;
    } catch (fallo) {
      setError(fallo?.message || 'No se pudo preparar el recorte.');

      return null;
    }
  }, [origen, area, alto, porEncuadrar, onCambiar, limpiarEncuadre]);

  useImperativeHandle(ref, () => ({ confirmarEncuadre }), [confirmarEncuadre]);

  const enEncuadre = !!origen;

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">Fotografía de la portada</Typography>

      <Box
        ref={marcoRef}
        sx={{
          width: 1,
          borderRadius: 1.5,
          overflow: 'hidden',
          position: 'relative',
          // LA MISMA FORMA QUE LA PORTADA. No el mismo tamaño: el dialogo es
          // mas estrecho que la pagina, asi que medir igual de ancho es
          // imposible sin ensancharlo. Lo que si se puede —y es lo que hace
          // falta para encuadrar— es ver EL MISMO TROZO de foto: el encabezado
          // entero, a menor escala. Con el alto en pixeles y el ancho recortado
          // se veia un pedazo ampliado, y ahi no se juzga el encuadre.
          aspectRatio: `${ANCHO} / ${Math.round(alto * ESTIRADO_VERTICAL)}`,
          bgcolor: 'common.black',
          border: (theme) => `dashed 1px ${theme.vars.palette.divider}`,
        }}
      >
        {enEncuadre && (
          <Cropper
            // Con cada foto, un recortador nuevo: reutilizando el mismo se
            // quedaba el encuadre de la anterior sobre una imagen distinta.
            key={origen}
            image={origen}
            crop={posicion}
            zoom={acercamiento}
            aspect={proporcion}
            showGrid={false}
            // QUE LLENE EL RECUADRO DE ENTRADA. Por defecto la foto se mete
            // entera dentro y deja franjas negras a los lados: parecia que el
            // encuadre ya estaba mal antes de tocar nada.
            objectFit="cover"
            onCropChange={setPosicion}
            onZoomChange={setAcercamiento}
            onCropComplete={(_, areaEnPixeles) => setArea(areaEnPixeles)}
          />
        )}

        {!enEncuadre && vistaPrevia && (
          <Box
            component="img"
            alt="Fotografía de la portada"
            src={vistaPrevia}
            sx={{ width: 1, height: 1, objectFit: 'cover', display: 'block' }}
          />
        )}

        {/* EL ESCUDO Y LOS TEXTOS, ENCIMA. Una foto sola no dice nada: lo que
            hay que decidir al encuadrarla es si el titulo se va a leer sobre
            ella y si la cara importante queda tapada. Mientras se encuadra no
            se pintan —estorbarian al arrastrar—, pero en cuanto se suelta se ve
            la portada entera. */}
        {!enEncuadre && !!superposicion && escala > 0 && (
          <Box
            sx={{
              top: 0,
              left: 0,
              position: 'absolute',
              pointerEvents: 'none',
              // Se pinta al tamaño REAL del encabezado y se encoge entera,
              // como una maqueta. Dibujarla con tamaños de letra fijos dentro de
              // un recuadro mas pequeño la descuadraba —el titulo encima del
              // lema en una pantalla y holgado en otra—, porque el texto no
              // encogia con la caja.
              width: medidaPortada.ancho,
              height: medidaPortada.alto,
              transform: `scale(${escala})`,
              transformOrigin: 'top left',
            }}
          >
            {superposicion}
          </Box>
        )}

        {!enEncuadre && !vistaPrevia && (
          <Stack
            spacing={0.5}
            alignItems="center"
            justifyContent="center"
            sx={{ width: 1, height: 1, color: 'text.disabled' }}
          >
            <Iconify icon="solar:gallery-add-bold" width={32} />

            <Typography variant="caption">Sin fotografía: la portada usa el degradado</Typography>
          </Stack>
        )}
      </Box>

      {enEncuadre && (
        <Stack direction="row" spacing={2} alignItems="center">
          <Iconify icon="solar:minus-circle-bold" width={20} sx={{ color: 'text.disabled' }} />

          <Slider
            min={1}
            max={3}
            step={0.01}
            value={acercamiento}
            onChange={(_, valor) => setAcercamiento(valor)}
            aria-label="Acercar la fotografía"
          />

          <Iconify icon="solar:add-circle-bold" width={20} sx={{ color: 'text.disabled' }} />
        </Stack>
      )}

      {!!error && (
        <Typography variant="caption" sx={{ color: 'error.main' }}>
          {error}
        </Typography>
      )}

      {/* SIEMPRE LA MISMA FILA, se este encuadrando o no: los botones ya no
          aparecen y desaparecen debajo del recuadro. */}
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
        <Typography variant="caption" sx={{ mr: 'auto', color: 'text.disabled' }}>
          {enEncuadre
            ? 'Arrastra la foto para moverla y acércala con el control. Se guarda con el encabezado.'
            : ''}
        </Typography>

        {!!vistaPrevia && (
          <Button
            color="error"
            disabled={deshabilitado}
            onClick={() => onCambiar?.(null, '')}
            startIcon={<Iconify icon="solar:trash-bin-trash-bold" />}
          >
            Quitar
          </Button>
        )}

        {/* EL BOTON *ES* LA ETIQUETA DEL CAMPO, no algo que le da un clic por
                dentro. Pedirle al navegador que pulse un `input` escondido
                funciona a veces y a veces no —depende del navegador y de como
                este oculto—, y por eso cambiar la foto una segunda vez no abria
                nada. Con `label` lo abre el propio navegador, siempre.

                La `key` cambia con la foto que ya hay: asi el campo nace vacio
                en cada ronda y volver a elegir el MISMO archivo tambien cuenta
                como cambio. */}
        <Button
          component="label"
          color="inherit"
          disabled={deshabilitado}
          startIcon={<Iconify icon="solar:gallery-add-bold" />}
        >
          {vistaPrevia ? 'Cambiar foto' : 'Agregar foto'}

          <input
            hidden
            type="file"
            accept="image/*"
            key={vistaPrevia || 'sin-foto'}
            onChange={handleElegirArchivo}
          />
        </Button>
      </Stack>
    </Stack>
  );
}
