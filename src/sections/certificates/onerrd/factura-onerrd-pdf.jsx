import { pdf, Page, Text, View, Image, Document } from '@react-pdf/renderer';

import { cajaDeImagenOnerrd } from 'src/utils/certificado-onerrd.mjs';
import {
  radiosDeEsquinas,
  cajaDeFormaFactura,
  cajaDeLineaFactura,
  cajaDeSelloFactura,
  cajaDeTablaFactura,
  LOGO_FACTURA_ONERRD,
  PAGINA_FACTURA_ONERRD,
} from 'src/utils/factura-onerrd.mjs';

import { tipografiaPdf, TextoOnerrdPdf } from './onerrd-pdf';

// ----------------------------------------------------------------------
// EL PDF DE LA FACTURA ONERRD, con su diseño (el de "Diseño de la factura").
//
// Los textos son campos del certificado y se pintan con su mismo componente
// (`TextoOnerrdPdf`: letra, contorno, degradado, giro). La tabla, la raya y el
// sello salen de las MISMAS cajas que la vista previa (`factura-onerrd.mjs`):
// lo que se ve es lo que sale. Importar `onerrd-pdf` registra las fuentes.
// ----------------------------------------------------------------------

const posicion = (caja) => ({ position: 'absolute', ...caja });

const esquinas = ({ tl, tr, br, bl }) => ({
  borderTopLeftRadius: tl,
  borderTopRightRadius: tr,
  borderBottomRightRadius: br,
  borderBottomLeftRadius: bl,
});

// Una forma: su caja, relleno, borde, esquinas, giro e inclinación (como la
// vista previa, sobre su centro).
function FormaPdf({ forma }) {
  const caja = cajaDeFormaFactura(forma);
  const transform = [
    forma.rotacion ? `rotate(${forma.rotacion}deg)` : '',
    forma.inclinacion ? `skewX(${forma.inclinacion}deg)` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <View
      style={{
        ...posicion(caja),
        ...(forma.relleno ? { backgroundColor: forma.relleno } : {}),
        ...(forma.colorBorde && forma.grosorBorde
          ? { borderWidth: forma.grosorBorde, borderColor: forma.colorBorde }
          : {}),
        ...esquinas(radiosDeEsquinas(forma.radio, forma.esquinas, caja)),
        ...(transform ? { transform } : {}),
      }}
    />
  );
}

const letraDeTabla = (tabla, negrita = false) => ({
  ...tipografiaPdf({ fuente: tabla.fuente, peso: negrita ? 700 : 400, negrita }),
  fontSize: tabla.tamano,
  color: tabla.colorTexto,
});

function Celda({ caja, fondo, children, alinear = 'left', estilo }) {
  return (
    <View
      style={{
        ...posicion(caja),
        backgroundColor: fondo || undefined,
        justifyContent: 'center',
        paddingHorizontal: 3,
      }}
    >
      {typeof children === 'string' ? (
        <Text style={{ ...estilo, textAlign: alinear }}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

function TablaPdf({ tabla, datos }) {
  const c = cajaDeTablaFactura(tabla, datos);
  const borde = tabla.grosorBorde;
  const letra = letraDeTabla(tabla);
  const negrita = letraDeTabla(tabla, true);
  const titulos = [
    tabla.titulos.descripcion,
    tabla.titulos.precio,
    tabla.titulos.cantidad,
    tabla.titulos.importe,
  ];
  const importe = c.columnas[3];
  // Encabezado relleno, esquinas redondeadas y TOTAL en su caja: la tabla de
  // fábrica. Sin color de encabezado, la de antes (como la vista previa).
  const rellena = !!tabla.colorEncabezado;
  const r = tabla.radio;
  const negritaEncabezado = rellena
    ? { ...negrita, color: tabla.colorTextoEncabezado || tabla.colorTexto }
    : negrita;
  const ultima = c.filas[c.filas.length - 1];

  return (
    <>
      {rellena && (
        <View
          style={{
            ...posicion({ left: c.left, top: c.top, width: c.width, height: c.alto }),
            backgroundColor: tabla.colorEncabezado,
            ...esquinas({ tl: r, tr: r, br: 0, bl: 0 }),
          }}
        />
      )}
      {/* Fondos: franjas y la columna del importe entera. */}
      {c.filas
        .filter((fila) => fila.franja)
        .map((fila) => (
          <View
            key={`f${fila.top}`}
            style={posicion({
              left: c.left,
              top: fila.top,
              width: c.width - importe.width,
              height: fila.height,
              backgroundColor: tabla.colorFranja,
              ...(fila === ultima && r ? { borderBottomLeftRadius: r } : {}),
            })}
          />
        ))}
      <View
        style={posicion({
          left: importe.left,
          top: c.top + c.alto,
          width: importe.width,
          height: c.bottom - c.top - c.alto,
          backgroundColor: tabla.colorImporte,
          ...(r ? { borderBottomRightRadius: r } : {}),
        })}
      />

      {/* Marco, raya bajo el encabezado y separadores de columna. */}
      <View
        style={posicion({
          left: c.left,
          top: c.top,
          width: c.width,
          height: c.bottom - c.top,
          borderWidth: borde,
          borderColor: tabla.colorBorde,
          ...(r ? { borderRadius: r } : {}),
        })}
      />
      <View
        style={posicion({
          left: c.left,
          top: c.top + c.alto - borde / 2,
          width: c.width,
          height: borde,
          backgroundColor: tabla.colorBorde,
        })}
      />
      {c.columnas.slice(1).map((columna) => (
        <View
          key={columna.left}
          style={posicion({
            left: columna.left - borde / 2,
            top: c.top,
            width: borde,
            height: c.bottom - c.top,
            backgroundColor: tabla.colorBorde,
          })}
        />
      ))}

      {titulos.map((titulo, i) => (
        <Celda
          key={`t${i}`}
          caja={{ ...c.columnas[i], top: c.encabezado.top, height: c.alto }}
          alinear="center"
          estilo={negritaEncabezado}
        >
          {titulo}
        </Celda>
      ))}

      {c.filas
        .filter((fila) => fila.linea)
        .map((fila) => (
          <View key={`l${fila.top}`}>
            <Celda caja={{ ...c.columnas[0], top: fila.top, height: fila.height }}>
              <View>
                <Text style={letra}>{fila.linea.descripcion}</Text>
                {!!fila.linea.detalle && <Text style={letra}>{fila.linea.detalle}</Text>}
              </View>
            </Celda>
            <Celda
              caja={{ ...c.columnas[1], top: fila.top, height: fila.height }}
              alinear="right"
              estilo={letra}
            >
              {fila.linea.precio}
            </Celda>
            <Celda
              caja={{ ...c.columnas[2], top: fila.top, height: fila.height }}
              alinear={rellena ? 'center' : 'right'}
              estilo={letra}
            >
              {String(fila.linea.cantidad)}
            </Celda>
            <Celda caja={{ ...importe, top: fila.top, height: fila.height }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={letra}>{datos.moneda}</Text>
                <Text style={letra}>{fila.linea.importe}</Text>
              </View>
            </Celda>
          </View>
        ))}

      {/* TOTAL en su caja: rótulo relleno a la izquierda, importe a la derecha. */}
      {rellena && (
        <>
          <View
            style={{
              ...posicion(c.marcoTotales),
              backgroundColor: tabla.colorImporte,
              ...(r ? { borderRadius: r } : {}),
            }}
          />
          <View
            style={{
              ...posicion({
                ...c.etiquetaTotales,
                top: c.marcoTotales.top,
                height: c.marcoTotales.height,
              }),
              backgroundColor: tabla.colorEncabezado,
              ...esquinas({ tl: r, tr: 0, br: 0, bl: r }),
            }}
          />
          {c.totales.map((fila) => (
            <View key={fila.etiqueta}>
              <Celda
                caja={{ ...c.etiquetaTotales, top: fila.top, height: fila.height }}
                alinear="center"
                estilo={negritaEncabezado}
              >
                {fila.etiqueta}
              </Celda>
              <View
                style={{
                  ...posicion({ ...importe, top: fila.top, height: fila.height }),
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 6,
                }}
              >
                <Text style={{ ...(fila.total ? negrita : letra), color: tabla.colorTotal }}>
                  {datos.moneda}
                </Text>
                <Text style={{ ...(fila.total ? negrita : letra), color: tabla.colorTotal }}>
                  {fila.valor}
                </Text>
              </View>
            </View>
          ))}
          <View
            style={{
              ...posicion(c.marcoTotales),
              borderWidth: borde,
              borderColor: tabla.colorBorde,
              ...(r ? { borderRadius: r } : {}),
            }}
          />
        </>
      )}

      {/* Subtotal, descuento, impuestos y TOTAL, bajo la columna del importe. */}
      {!rellena &&
        c.totales.map((fila) => (
          <View key={fila.etiqueta}>
            <Celda
              caja={{
                left: c.columnas[1].left,
                top: fila.top,
                width: c.columnas[1].width + c.columnas[2].width - 6,
                height: fila.height,
              }}
              alinear="right"
              estilo={negrita}
            >
              {fila.etiqueta}
            </Celda>
            <View
              style={{
                ...posicion({ ...importe, top: fila.top, height: fila.height }),
                backgroundColor: tabla.colorImporte,
                borderWidth: borde * 0.8,
                borderColor: '#7F7F7F',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 6,
              }}
            >
              <Text style={{ ...negrita, color: tabla.colorTotal }}>{datos.moneda}</Text>
              <Text style={{ ...negrita, color: tabla.colorTotal }}>{fila.valor}</Text>
            </View>
          </View>
        ))}
    </>
  );
}

function SelloPdf({ sello, texto }) {
  const caja = cajaDeSelloFactura(sello, texto);
  return (
    <View
      style={{
        ...posicion({ left: caja.left, top: caja.top, width: caja.width, height: caja.height }),
        borderWidth: sello.grosorBorde,
        borderColor: sello.colorBorde,
        ...(sello.radio ? { borderRadius: sello.radio } : {}),
        alignItems: 'center',
        justifyContent: 'center',
        transform: `rotate(${sello.rotacion}deg)`,
      }}
    >
      <Text
        style={{
          ...tipografiaPdf({ fuente: sello.fuente, peso: 700, negrita: true }),
          fontSize: caja.tamano,
          letterSpacing: caja.espaciado,
          color: sello.colorTexto,
        }}
      >
        {texto}
      </Text>
    </View>
  );
}

function FacturaOnerrd({ diseno, datos, campos, imagenes, qr }) {
  const pagina = PAGINA_FACTURA_ONERRD;
  return (
    <Document title={`Factura ${datos.numero}`} author="Oficina Nacional ERRD" creator="EXPEDITION">
      <Page size={{ width: pagina.ancho, height: pagina.alto }} style={{ padding: 0 }}>
        {diseno.logo?.visible && (
          <Image
            src={LOGO_FACTURA_ONERRD.src}
            style={{
              ...posicion(cajaDeImagenOnerrd(diseno.logo, LOGO_FACTURA_ONERRD.proporcion, pagina)),
              ...(diseno.logo.rotacion ? { transform: `rotate(${diseno.logo.rotacion}deg)` } : {}),
            }}
          />
        )}
        {/* Las imágenes subidas, debajo de todo (como en la vista previa). */}
        {(diseno.imagenes || [])
          .filter((imagen) => imagen.visible && imagenes?.[imagen.id]?.dataUrl)
          .map((imagen) => (
            <Image
              key={imagen.id}
              src={imagenes[imagen.id].dataUrl}
              style={{
                ...posicion(cajaDeImagenOnerrd(imagen, imagenes[imagen.id].proporcion, pagina)),
                ...(imagen.rotacion ? { transform: `rotate(${imagen.rotacion}deg)` } : {}),
              }}
            />
          ))}
        {/* Las formas (barras, rayas, recuadros), bajo la tabla y los textos. */}
        {(diseno.formas || [])
          .filter((forma) => forma.visible)
          .map((forma) => (
            <FormaPdf key={forma.id} forma={forma} />
          ))}
        {diseno.tabla.visible && <TablaPdf tabla={diseno.tabla} datos={datos} />}
        {diseno.linea.visible && (
          <View
            style={{
              ...posicion(cajaDeLineaFactura(diseno.linea)),
              backgroundColor: diseno.linea.color,
            }}
          />
        )}
        {campos.map((texto) => (
          <TextoOnerrdPdf key={texto.campo.id} {...texto} pagina={pagina} />
        ))}
        {diseno.sello.visible && !!datos.sello && (
          <SelloPdf sello={diseno.sello} texto={datos.sello} />
        )}
        {/* El QR: abre la factura guardada (en el mismo contenedor que el certificado). */}
        {qr && diseno.qr?.visible && (
          <Image src={qr} style={posicion(cajaDeImagenOnerrd(diseno.qr, 1, pagina))} />
        )}
      </Page>
    </Document>
  );
}

// `campos`: los textos ya preparados (`prepararTextosParaPdfOnerrd`).
// `imagenes`: { id: { dataUrl, proporcion } } de las subidas a la factura.
// `qr`: data URL del código (abre la factura guardada).
export const generarFacturaOnerrdPdf = ({ diseno, datos, campos, imagenes = {}, qr = null }) =>
  pdf(
    <FacturaOnerrd diseno={diseno} datos={datos} campos={campos} imagenes={imagenes} qr={qr} />
  ).toBlob();
