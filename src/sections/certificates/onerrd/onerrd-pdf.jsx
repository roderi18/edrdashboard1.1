import { Fragment } from 'react';
import { pdf, Font, Page, Text, View, Image, Document } from '@react-pdf/renderer';

import {
  PESOS_ONERRD,
  cajaDeTextoOnerrd,
  pesoDeCampoOnerrd,
  cajaDeImagenOnerrd,
  INTERLINEADO_ONERRD,
  desplazamientosDeContorno,
} from 'src/utils/certificado-onerrd.mjs';

// ----------------------------------------------------------------------
// PDF DEL CERTIFICADO ONERRD. Se carga con `import()` al descargar: el
// renderizador de PDF pesa cerca de medio megabyte y no hace falta para
// diseñar.
//
// Las cajas salen de las mismas funciones que la vista previa
// (`certificado-onerrd.mjs`) y los tamaños de letra ya vienen ajustados al
// ancho desde el navegador: lo que se ve en pantalla es lo que sale.
// ----------------------------------------------------------------------

Font.register({
  family: 'OnerrdRoboto',
  fonts: [
    { src: '/fuentes/Roboto-Regular.ttf', fontWeight: 400 },
    { src: '/fuentes/Roboto-Bold.ttf', fontWeight: 700 },
  ],
});

Font.register({
  family: 'OnerrdOswald',
  fonts: Object.entries(PESOS_ONERRD).map(([peso, { archivo }]) => ({
    src: `/fuentes/Oswald-${archivo}.ttf`,
    fontWeight: Number(peso),
  })),
});

Font.register({ family: 'OnerrdAnton', src: '/fuentes/Anton-Regular.ttf' });

// Sin partir palabras con guiones: un nombre propio cortado "Gui-llén" en un
// certificado no se acepta.
Font.registerHyphenationCallback((palabra) => [palabra]);

const ESTANDAR = {
  Helvetica: ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique'],
  Times: ['Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic'],
  Courier: ['Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique'],
};

const tipografiaPdf = (campo) => {
  if (campo.fuente === 'Roboto' || campo.fuente === 'Oswald') {
    return { fontFamily: `Onerrd${campo.fuente}`, fontWeight: pesoDeCampoOnerrd(campo) };
  }
  if (campo.fuente === 'Anton') return { fontFamily: 'OnerrdAnton' };
  const variantes = ESTANDAR[campo.fuente] || ESTANDAR.Helvetica;
  const indice = (campo.negrita ? 1 : 0) + (campo.cursiva ? 2 : 0);
  return { fontFamily: variantes[indice] };
};

// Los textos que se encogen para caber llevan una holgura invisible: las
// medidas de la fuente del PDF y las del navegador difieren por décimas, y
// sin ella un nombre justo al límite saltaba a una segunda línea.
const HOLGURA_AJUSTE = 0.08;

const cajaConHolgura = (campo, caja) => {
  if (!campo.ajustarAlAncho) return caja;
  const extra = caja.width * HOLGURA_AJUSTE;
  const desplazamiento = { left: 0, center: extra / 2, right: extra }[campo.alineacion] ?? 0;
  return { ...caja, left: caja.left - desplazamiento, width: caja.width + extra };
};

function CertificadoOnerrd({
  pagina,
  fondo,
  imagen,
  iconoRegion,
  diseno,
  firmasPorId,
  textos,
  qr,
}) {
  const posicion = (caja) => ({ position: 'absolute', ...caja });

  return (
    <Document title={textos.titulo} author="Oficina Nacional ERRD" creator="EXPEDITION">
      <Page size={{ width: pagina.ancho, height: pagina.alto }} style={{ padding: 0 }}>
        {fondo && (
          <Image
            src={fondo}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: pagina.ancho,
              height: pagina.alto,
            }}
          />
        )}

        {imagen?.dataUrl && diseno.imagen.visible && (
          <Image
            src={imagen.dataUrl}
            style={posicion(cajaDeImagenOnerrd(diseno.imagen, imagen.proporcion, pagina))}
          />
        )}

        {iconoRegion?.dataUrl && diseno.iconoRegion?.visible && (
          <Image
            src={iconoRegion.dataUrl}
            style={posicion(cajaDeImagenOnerrd(diseno.iconoRegion, iconoRegion.proporcion, pagina))}
          />
        )}

        {diseno.firmas.map((ranura) => {
          const firma = firmasPorId[ranura.idFirma];
          if (!firma?.dataUrl) return null;
          return (
            <Image
              key={ranura.id}
              src={firma.dataUrl}
              style={{
                ...posicion(cajaDeImagenOnerrd(ranura, firma.proporcion, pagina)),
                // Sobre su centro, como en la vista previa.
                ...(ranura.rotacion ? { transform: `rotate(${ranura.rotacion}deg)` } : {}),
              }}
            />
          );
        })}

        {qr && diseno.qr?.visible && (
          <Image src={qr.dataUrl} style={posicion(cajaDeImagenOnerrd(diseno.qr, 1, pagina))} />
        )}

        {textos.campos.map(({ campo, texto, tamano, lineaBase, dibujo }) => {
          // Con degradado, el texto ya viene dibujado por el navegador.
          if (dibujo) {
            return <Image key={campo.id} src={dibujo.dataUrl} style={posicion(dibujo.caja)} />;
          }
          const caja = cajaConHolgura(campo, cajaDeTextoOnerrd(campo, tamano, pagina, lineaBase));
          const letra = {
            ...tipografiaPdf(campo),
            fontSize: tamano,
            lineHeight: INTERLINEADO_ONERRD,
            textAlign: campo.alineacion,
            letterSpacing: campo.espaciado,
          };
          const contorno = campo.contorno ? desplazamientosDeContorno(campo.grosorContorno) : [];
          return (
            <Fragment key={campo.id}>
              {/* El contorno: copias desplazadas, debajo del texto. */}
              {contorno.map(([dx, dy]) => (
                <View
                  key={`${dx},${dy}`}
                  style={posicion({ ...caja, left: caja.left + dx, top: caja.top + dy })}
                >
                  <Text style={{ ...letra, color: campo.contorno }}>{texto}</Text>
                </View>
              ))}
              <View style={posicion(caja)}>
                <Text style={{ ...letra, color: campo.color }}>{texto}</Text>
              </View>
            </Fragment>
          );
        })}
      </Page>
    </Document>
  );
}

// `textos.campos`: [{ campo, texto, tamano, lineaBase }] ya resueltos (y la
// línea base medida) por la pantalla.
export async function generarPdfOnerrd(props) {
  return pdf(<CertificadoOnerrd {...props} />).toBlob();
}
