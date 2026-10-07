import Box from '@mui/material/Box';

import { cajaDeImagenOnerrd } from 'src/utils/certificado-onerrd.mjs';
import {
  cajaDeLineaFactura,
  cajaDeSelloFactura,
  cajaDeTablaFactura,
  LOGO_FACTURA_ONERRD,
  PAGINA_FACTURA_ONERRD,
} from 'src/utils/factura-onerrd.mjs';

import { cssDeFuenteOnerrd } from './imagenes-onerrd';

// ----------------------------------------------------------------------
// LA TABLA, LA RAYA Y EL SELLO DE LA FACTURA EN EL LIENZO. El lienzo del
// certificado (`LienzoOnerrd`) los pinta con `renderExtras` y les presta sus
// herramientas: elegir, mover, estirar (asa) y girar (el sello). Las medidas
// son las mismas cajas que el PDF (`factura-onerrd.mjs`), en cqw.
// ----------------------------------------------------------------------

const PAGINA = PAGINA_FACTURA_ONERRD;

// `imagenes`: { id: { dataUrl, proporcion } } de las subidas a la factura.
export function pintarExtrasFactura({ diseno, datos, imagenes = {} }, herramientas) {
  const { unidad, modoVista, esElegido, contorno, empezarMover, empezarEstirar } = herramientas;
  const { empezarRotar, asaDeGiro, Asa } = herramientas;
  const cq = (pt) => `${pt * unidad}cqw`;

  // Un bloque que se elige, se arrastra y se estira, en su caja (pt).
  // `id`: el del elemento en su lista (imágenes); la tabla, el sello y la raya
  // son uno de cada y se llaman como su tipo.
  const bloque = (tipo, elemento, caja, hijos, { giro = false, id = tipo, ...estilo } = {}) => {
    const elegido = esElegido(tipo, id);
    return (
      <Box
        key={`${tipo}-${id}`}
        onPointerDown={modoVista ? undefined : empezarMover(tipo, id, elemento)}
        sx={{
          position: 'absolute',
          left: cq(caja.left),
          top: cq(caja.top),
          width: cq(caja.width),
          height: cq(caja.height),
          cursor: modoVista ? 'default' : 'grab',
          touchAction: 'none',
          zIndex: elegido ? 2 : 1,
          ...contorno(elegido),
          ...estilo,
        }}
      >
        {hijos}
        {elegido && !modoVista && (
          <Asa
            cursor="ew-resize"
            sx={{ right: -7, bottom: -7 }}
            onPointerDown={empezarEstirar(tipo, id, elemento)}
          />
        )}
        {elegido && !modoVista && giro && asaDeGiro(empezarRotar(tipo, id, elemento))}
      </Box>
    );
  };

  const partes = [];

  // El logo de la cabecera (el emblema de la organización).
  if (diseno.logo?.visible) {
    const { logo } = diseno;
    partes.push(
      bloque(
        'logo',
        logo,
        cajaDeImagenOnerrd(logo, LOGO_FACTURA_ONERRD.proporcion, PAGINA),
        <Box
          component="img"
          src={LOGO_FACTURA_ONERRD.src}
          alt="Logo"
          draggable={false}
          sx={{ width: 1, height: 1, display: 'block', pointerEvents: 'none' }}
        />,
        { giro: true, ...(logo.rotacion ? { transform: `rotate(${logo.rotacion}deg)` } : {}) }
      )
    );
  }

  // Las imágenes subidas, debajo de todo lo demás (como un fondo o un logo).
  (diseno.imagenes || [])
    .filter((imagen) => imagen.visible)
    .forEach((imagen) => {
      const archivo = imagenes[imagen.id];
      if (!archivo && modoVista) return;
      const caja = cajaDeImagenOnerrd(imagen, archivo?.proporcion || 0.6, PAGINA);
      partes.push(
        bloque(
          'imagenes',
          imagen,
          caja,
          archivo ? (
            <Box
              component="img"
              src={archivo.dataUrl}
              alt={archivo.nombreArchivo || 'Imagen de la factura'}
              draggable={false}
              sx={{ width: 1, height: 1, display: 'block', pointerEvents: 'none' }}
            />
          ) : (
            <Box
              sx={{
                width: 1,
                height: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(31,79,166,0.08)',
                color: 'rgba(15,23,42,0.6)',
                fontSize: 12,
              }}
            >
              Cargando imagen…
            </Box>
          ),
          {
            id: imagen.id,
            giro: true,
            ...(imagen.rotacion ? { transform: `rotate(${imagen.rotacion}deg)` } : {}),
          }
        )
      );
    });

  if (diseno.tabla.visible) {
    const { tabla } = diseno;
    const c = cajaDeTablaFactura(tabla, datos, PAGINA);
    const borde = tabla.grosorBorde;
    const importe = c.columnas[3];
    const letra = {
      fontFamily: cssDeFuenteOnerrd(tabla.fuente),
      fontSize: cq(tabla.tamano),
      color: tabla.colorTexto,
      lineHeight: 1.15,
    };
    // Dentro del bloque, las cajas van desde su esquina.
    const en = (caja) => ({
      position: 'absolute',
      left: cq(caja.left - c.left),
      top: cq(caja.top - c.top),
      width: cq(caja.width),
      height: cq(caja.height),
    });
    const celda = (caja, contenido, alinear = 'left', negrita = false) => (
      <Box
        sx={{
          ...en(caja),
          ...letra,
          fontWeight: negrita ? 700 : 400,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          textAlign: alinear,
          px: cq(3),
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {contenido}
      </Box>
    );
    const titulos = ['descripcion', 'precio', 'cantidad', 'importe'];
    const altoTabla = c.bottom - c.top;

    partes.push(
      bloque(
        'tabla',
        tabla,
        { left: c.left, top: c.top, width: c.width, height: c.height },
        <>
          {c.filas
            .filter((fila) => fila.franja)
            .map((fila) => (
              <Box
                key={`f${fila.top}`}
                sx={{
                  ...en({
                    left: c.left,
                    top: fila.top,
                    width: c.width - importe.width,
                    height: fila.height,
                  }),
                  bgcolor: tabla.colorFranja,
                }}
              />
            ))}
          <Box
            sx={{
              ...en({
                left: importe.left,
                top: c.top + c.alto,
                width: importe.width,
                height: altoTabla - c.alto,
              }),
              bgcolor: tabla.colorImporte,
            }}
          />
          <Box
            sx={{
              ...en({ left: c.left, top: c.top, width: c.width, height: altoTabla }),
              border: `${cq(borde)} solid ${tabla.colorBorde}`,
              boxSizing: 'border-box',
            }}
          />
          <Box
            sx={{
              ...en({
                left: c.left,
                top: c.top + c.alto - borde / 2,
                width: c.width,
                height: borde,
              }),
              bgcolor: tabla.colorBorde,
            }}
          />
          {c.columnas.slice(1).map((columna) => (
            <Box
              key={columna.left}
              sx={{
                ...en({
                  left: columna.left - borde / 2,
                  top: c.top,
                  width: borde,
                  height: altoTabla,
                }),
                bgcolor: tabla.colorBorde,
              }}
            />
          ))}
          {titulos.map((clave, i) => (
            <Box key={clave}>
              {celda(
                { ...c.columnas[i], top: c.top, height: c.alto },
                tabla.titulos[clave],
                'center',
                true
              )}
            </Box>
          ))}
          {c.filas
            .filter((fila) => fila.linea)
            .map((fila) => (
              <Box key={`l${fila.top}`}>
                {celda(
                  { ...c.columnas[0], top: fila.top, height: fila.height },
                  <>
                    <span>{fila.linea.descripcion}</span>
                    {!!fila.linea.detalle && <span>{fila.linea.detalle}</span>}
                  </>
                )}
                {celda(
                  { ...c.columnas[1], top: fila.top, height: fila.height },
                  fila.linea.precio,
                  'right'
                )}
                {celda(
                  { ...c.columnas[2], top: fila.top, height: fila.height },
                  String(fila.linea.cantidad),
                  'right'
                )}
                {celda(
                  { ...importe, top: fila.top, height: fila.height },
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{datos.moneda}</span>
                    <span>{fila.linea.importe}</span>
                  </Box>
                )}
              </Box>
            ))}
          {c.totales.map((fila) => (
            <Box key={fila.etiqueta}>
              {celda(
                {
                  left: c.columnas[1].left,
                  top: fila.top,
                  width: c.columnas[1].width + c.columnas[2].width - 6,
                  height: fila.height,
                },
                fila.etiqueta,
                'right',
                true
              )}
              <Box
                sx={{
                  ...en({ ...importe, top: fila.top, height: fila.height }),
                  ...letra,
                  fontWeight: 700,
                  color: tabla.colorTotal,
                  bgcolor: tabla.colorImporte,
                  border: `${cq(borde * 0.8)} solid #7F7F7F`,
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: cq(6),
                }}
              >
                <span>{datos.moneda}</span>
                <span>{fila.valor}</span>
              </Box>
            </Box>
          ))}
        </>
      )
    );
  }

  if (diseno.linea.visible) {
    const caja = cajaDeLineaFactura(diseno.linea, PAGINA);
    // Una raya fina se elige mal: su zona de clic es más alta que ella.
    partes.push(
      bloque(
        'linea',
        diseno.linea,
        { ...caja, top: caja.top - 3, height: caja.height + 6 },
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: cq(3),
            height: cq(caja.height),
            bgcolor: diseno.linea.color,
          }}
        />
      )
    );
  }

  if (diseno.sello.visible && datos.sello) {
    const { sello } = diseno;
    const caja = cajaDeSelloFactura(sello, datos.sello, PAGINA);
    partes.push(
      bloque(
        'sello',
        sello,
        caja,
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            border: `${cq(sello.grosorBorde)} solid ${sello.colorBorde}`,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: cssDeFuenteOnerrd(sello.fuente),
            fontWeight: 700,
            fontSize: cq(caja.tamano),
            letterSpacing: cq(caja.espaciado),
            lineHeight: 1.2,
            color: sello.colorTexto,
            whiteSpace: 'nowrap',
          }}
        >
          {datos.sello}
        </Box>,
        { transform: `rotate(${sello.rotacion}deg)`, giro: true }
      )
    );
  }

  return partes;
}
