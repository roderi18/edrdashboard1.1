// Qué se rompía: `public/` mezclaba lo que sirve la aplicación con documentos
// internos (directorios de región, listas de destacamentos, .rar) que cualquiera
// podía descargar con solo poner la dirección. Se reorganizó (logo → marca,
// icons → iconos, parches → insignias; lo demás a `docs/`), y las rutas viejas
// redirigen. Esto vigila que cada redirección lleve a un archivo que existe y que
// `public/` no vuelva a guardar documentos.
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { RUTAS_ANTIGUAS_DE_IMAGENES } = await import('src/utils/rutas-antiguas-de-imagenes.mjs');

const RAIZ = process.cwd();
const enPublic = (ruta) => path.join(RAIZ, 'public', decodeURIComponent(ruta));

test('cada ruta vieja de imagen lleva a un archivo o carpeta que existe', () => {
  for (const { source, destination } of RUTAS_ANTIGUAS_DE_IMAGENES) {
    const destino = destination.replace(/\/:archivo$/, '');
    assert.ok(fs.existsSync(enPublic(destino)), `${source} → ${destination} no existe`);
  }
});

test('las redirecciones llevan un archivo con el mismo nombre al mismo nombre', () => {
  for (const { source, destination } of RUTAS_ANTIGUAS_DE_IMAGENES) {
    assert.equal(source.endsWith(':archivo'), destination.endsWith(':archivo'), source);
  }
});

test('las carpetas viejas ya no están en public', () => {
  for (const vieja of ['logo', 'icons', 'header', 'parches', 'pendientes']) {
    assert.equal(fs.existsSync(path.join(RAIZ, 'public', vieja)), false, `public/${vieja}`);
  }
});

// `assets/documents/` es la excepción: son los recursos que la aplicación ofrece
// para descargar a propósito (p. ej. "10 tipos de campamento" para los líderes).
test('public no guarda documentos de oficina ni comprimidos', () => {
  const descargables = path.join(RAIZ, 'public', 'assets', 'documents');
  const prohibidas = /\.(docx?|xlsx?|pptx?|rar|zip|7z|pdf)$/i;
  const hallados = [];
  const recorrer = (carpeta) => {
    for (const entrada of fs.readdirSync(carpeta, { withFileTypes: true })) {
      const ruta = path.join(carpeta, entrada.name);
      // La copia local de lo quitado: está en `.gitignore` y nunca se publica.
      if (ruta === descargables || entrada.name === 'documentosNoUsados.zip') continue;
      if (entrada.isDirectory()) recorrer(ruta);
      else if (prohibidas.test(entrada.name)) hallados.push(path.relative(RAIZ, ruta));
    }
  };
  recorrer(path.join(RAIZ, 'public'));
  assert.deepEqual(hallados, []);
});
