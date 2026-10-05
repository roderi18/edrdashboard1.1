// Qué se rompía: `public/` mezclaba lo que sirve la aplicación con documentos
// internos (directorios de región, listas de destacamentos, .rar) que cualquiera
// podía descargar con solo poner la dirección, y con cientos de imágenes que
// nada usaba. Se reorganizó en carpetas claras (app, marca, iconos, insignias,
// sistema-ascenso, fuentes, descargas, plantilla); lo que no se usaba está en
// `docs/documentosNoUsados.zip`, y las rutas viejas redirigen. Esto vigila que
// cada redirección lleve a un archivo que existe, que las carpetas viejas no
// vuelvan y que `public/` no guarde documentos ni carpetas sueltas.
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { RUTAS_ANTIGUAS_DE_IMAGENES } = await import('src/utils/rutas-antiguas-de-imagenes.mjs');

const RAIZ = process.cwd();
const PUBLIC = path.join(RAIZ, 'public');
const enPublic = (ruta) => path.join(PUBLIC, decodeURIComponent(ruta));

test('cada ruta vieja de imagen lleva a un archivo o carpeta que existe', () => {
  for (const { source, destination } of RUTAS_ANTIGUAS_DE_IMAGENES) {
    const destino = destination.replace(/\/:(archivo|ruta\*)$/, '');
    assert.ok(fs.existsSync(enPublic(destino)), `${source} → ${destination} no existe`);
  }
});

test('las redirecciones llevan un archivo con el mismo nombre al mismo nombre', () => {
  for (const { source, destination } of RUTAS_ANTIGUAS_DE_IMAGENES) {
    for (const parametro of [':archivo', ':ruta*']) {
      assert.equal(source.endsWith(parametro), destination.endsWith(parametro), source);
    }
  }
});

test('las carpetas viejas ya no están en public', () => {
  for (const vieja of [
    'logo',
    'icons',
    'header',
    'parches',
    'pendientes',
    'assets',
    'fonts',
    'sistemaAscenso',
    'sin-clasificar',
  ]) {
    assert.equal(fs.existsSync(path.join(PUBLIC, vieja)), false, `public/${vieja}`);
  }
});

test('en la raíz de public solo lo que el navegador pide ahí y las carpetas conocidas', () => {
  // `favicon.ico` lo pide el navegador solo; `sw.js` tiene que estar en la raíz
  // para controlar toda la aplicación, y `offline.html` es su página sin conexión.
  const permitidos = new Set([
    'favicon.ico',
    'sw.js',
    'offline.html',
    'app',
    'marca',
    'iconos',
    'insignias',
    'sistema-ascenso',
    'fuentes',
    'descargas',
    'plantilla',
  ]);
  const sobrantes = fs.readdirSync(PUBLIC).filter((nombre) => !permitidos.has(nombre));
  assert.deepEqual(sobrantes, []);
});

// `descargas/` es la excepción: son los recursos que la aplicación ofrece para
// descargar a propósito (p. ej. "10 tipos de campamento" para los líderes).
test('public no guarda documentos de oficina ni comprimidos', () => {
  const descargables = path.join(PUBLIC, 'descargas');
  const prohibidas = /\.(docx?|xlsx?|pptx?|rar|zip|7z|pdf)$/i;
  const hallados = [];
  const recorrer = (carpeta) => {
    for (const entrada of fs.readdirSync(carpeta, { withFileTypes: true })) {
      const ruta = path.join(carpeta, entrada.name);
      if (ruta === descargables) continue;
      if (entrada.isDirectory()) recorrer(ruta);
      else if (prohibidas.test(entrada.name)) hallados.push(path.relative(RAIZ, ruta));
    }
  };
  recorrer(PUBLIC);
  assert.deepEqual(hallados, []);
});
