import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// El upstream (systexploradores.somee.com) se cae y vuelve. Lo que no puede pasar
// es que UN tropiezo suyo —sobre todo el del refresco por detras, que nadie
// espera— borre la ultima respuesta buena y deje la pantalla en un 500 durante
// los minutos siguientes. Eso era el "Error al obtener seccionales".

const { fetchUpstreamText, invalidateUpstream } = await import('src/utils/upstream-cache.js');

const CLAVE = 'test:secciones';
const URL_FALSA = 'https://ejemplo.invalido/secciones';

const conFetch = async (impl, ejecutar) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl;

  try {
    return await ejecutar();
  } finally {
    globalThis.fetch = original;
  }
};

const respuesta = (texto, ok = true, status = 200) => ({
  ok,
  status,
  text: async () => texto,
});

test.beforeEach(() => {
  invalidateUpstream(CLAVE);
});

test('una respuesta buena se cachea y se reutiliza', async () => {
  let llamadas = 0;

  await conFetch(
    async () => {
      llamadas += 1;
      return respuesta('{"data":[1]}');
    },
    async () => {
      const primera = await fetchUpstreamText(CLAVE, URL_FALSA);
      const segunda = await fetchUpstreamText(CLAVE, URL_FALSA);

      assert.equal(primera.text, '{"data":[1]}');
      assert.equal(segunda.text, '{"data":[1]}');
      assert.equal(llamadas, 1);
    }
  );
});

test('si el upstream falla despues, se sirve la ultima respuesta buena', async () => {
  await conFetch(
    async () => respuesta('{"data":[1]}'),
    async () => fetchUpstreamText(CLAVE, URL_FALSA)
  );

  // `forzar` es lo que hace el refresco por detras cuando la entrada vence.
  const trasElFallo = await conFetch(
    async () => {
      throw new Error('socket hang up');
    },
    async () => fetchUpstreamText(CLAVE, URL_FALSA, { forzar: true })
  );

  assert.equal(trasElFallo.text, '{"data":[1]}');

  // Y la siguiente lectura sigue teniendo con que responder: la entrada buena no
  // se borro. Aqui esta el fallo que se arreglo — antes esto era un 500.
  const siguiente = await conFetch(
    async () => {
      throw new Error('socket hang up');
    },
    async () => fetchUpstreamText(CLAVE, URL_FALSA, { forzar: true })
  );

  assert.equal(siguiente.text, '{"data":[1]}');
});

test('un 500 del upstream tampoco pisa lo que ya funcionaba', async () => {
  await conFetch(
    async () => respuesta('{"data":[1]}'),
    async () => fetchUpstreamText(CLAVE, URL_FALSA)
  );

  const resultado = await conFetch(
    async () => respuesta('<html>error</html>', false, 500),
    async () => fetchUpstreamText(CLAVE, URL_FALSA, { forzar: true })
  );

  assert.equal(resultado.ok, true);
  assert.equal(resultado.text, '{"data":[1]}');
});

test('sin nada bueno guardado, el fallo sube tal cual', async () => {
  await assert.rejects(
    () =>
      conFetch(
        async () => {
          throw new Error('socket hang up');
        },
        async () => fetchUpstreamText(CLAVE, URL_FALSA)
      ),
    /socket hang up/
  );
});
