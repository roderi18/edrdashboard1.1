// La tarjeta editable de Desarrollo · pantalla se guarda en Firestore y se
// pinta tal cual: sin saneado, un ancho de 5 px o una URL `javascript:` llegaban
// directos al recuadro. Estos tests fijan que lo roto vuelve a fábrica.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sanearTarjeta,
  LIMITES_TARJETA,
  MAX_CAPAS,
  TARJETA_DE_FABRICA,
} from '../../src/utils/tarjeta-editable.mjs';

test('sin datos, la tarjeta es la de fábrica', () => {
  assert.deepEqual(sanearTarjeta(null), { ...TARJETA_DE_FABRICA });
});

test('los tamaños se quedan dentro de sus límites', () => {
  const t = sanearTarjeta({ ancho: 5, altoImagen: 9999, radio: 'x' });
  assert.equal(t.ancho, LIMITES_TARJETA.ancho.min);
  assert.equal(t.altoImagen, LIMITES_TARJETA.altoImagen.max);
  assert.equal(t.radio, TARJETA_DE_FABRICA.radio);
});

test('solo se acepta una imagen https', () => {
  assert.equal(sanearTarjeta({ imagenUrl: 'javascript:alert(1)' }).imagenUrl, '');
  assert.equal(sanearTarjeta({ imagenUrl: 'https://x/y.webp' }).imagenUrl, 'https://x/y.webp');
});

test('la foto original tambien solo se acepta https', () => {
  assert.equal(sanearTarjeta({ imagenOriginalUrl: 'data:x' }).imagenOriginalUrl, '');
  assert.equal(
    sanearTarjeta({ imagenOriginalUrl: 'https://x/o.webp' }).imagenOriginalUrl,
    'https://x/o.webp'
  );
});

test('los textos se guardan como vienen, recortados', () => {
  const t = sanearTarjeta({ titulo: 'Hola', subtitulo: 'a'.repeat(500) });
  assert.equal(t.titulo, 'Hola');
  assert.equal(t.subtitulo.length, 200);
  assert.equal(sanearTarjeta({ subtitulo: 3 }).subtitulo, TARJETA_DE_FABRICA.subtitulo);
});

test('tamaño de letra dentro de sus límites y solo fuentes cargadas', () => {
  const t = sanearTarjeta({ tamanoTitulo: 99, tamanoSubtitulo: 1, fuente: 'Comic Sans' });
  assert.equal(t.tamanoTitulo, LIMITES_TARJETA.tamanoTitulo.max);
  assert.equal(t.tamanoSubtitulo, LIMITES_TARJETA.tamanoSubtitulo.min);
  assert.equal(t.fuente, 'tema');
  assert.equal(sanearTarjeta({ fuente: 'barlow' }).fuente, 'barlow');
});

test('los campos quitados (precio, botón…) ya no salen aunque estén guardados', () => {
  const t = sanearTarjeta({ precio: '5 €', textoBoton: 'Unirse', duracion: '1h' });
  assert.equal('precio' in t || 'textoBoton' in t || 'duracion' in t, false);
});

test('las imágenes flotantes: solo https, dentro de la foto y como mucho diez', () => {
  const capas = sanearTarjeta({
    capas: [
      { id: 'a', url: 'https://x/a.webp', x: 150, y: -5, ancho: 1 },
      { id: 'b', url: 'javascript:alert(1)' },
      { id: 'c', url: 'blob:local' },
    ],
  }).capas;
  assert.equal(capas.length, 1);
  assert.deepEqual(
    { x: capas[0].x, y: capas[0].y, ancho: capas[0].ancho },
    { x: 100, y: 0, ancho: 5 }
  );

  const muchas = Array.from({ length: 15 }, (_, i) => ({ id: `c${i}`, url: 'https://x/c.webp' }));
  assert.equal(sanearTarjeta({ capas: muchas }).capas.length, MAX_CAPAS);
  assert.deepEqual(sanearTarjeta({ capas: 'x' }).capas, []);
});

test('texto de la placa: dos líneas, color hex y letra conocida', () => {
  const [capa] = sanearTarjeta({
    capas: [
      {
        id: 'p',
        url: 'https://x/placa.webp',
        textoArriba: 'Mirke de León',
        textoAbajo: '2008-2010',
        colorTexto: 'red',
        tamanoTexto: 200,
        fuenteTexto: 'Papyrus',
      },
    ],
  }).capas;
  assert.equal(capa.textoArriba, 'Mirke de León');
  assert.equal(capa.textoAbajo, '2008-2010');
  assert.equal(capa.colorTexto, '#2B1B0A');
  assert.equal(capa.tamanoTexto, 48);
  assert.equal(capa.fuenteTexto, 'serif');
});
