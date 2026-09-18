// ----------------------------------------------------------------------
// LA CONVERSIÓN DE FOTOS DE PERFIL A WEBP NO PISA NI BORRA NADA.
//
// Qué se quería evitar: un script que recorre todas las fotos de perfil y las
// reescribe. Si la WebP fuera a la misma ruta que la original, o convirtiera
// videos, o tocara fotos inactivas, el daño se repartiría entre cientos de
// perfiles de una vez y sin vuelta atrás.
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  esWebp,
  rutaWebpDe,
  planDeFoto,
  rutaDeLaFoto,
  resumirStorage,
} from '../../src/utils/fotos-webp.mjs';

const jpg = { tipo: 'image/jpeg' };
const webp = { tipo: 'image/webp' };

test('la WebP va al lado de la original, nunca encima', () => {
  assert.equal(rutaWebpDe('miembros/323/perfil.jpg'), 'miembros/323/perfil.webp');
  assert.equal(rutaWebpDe('regiones/3/perfil.png'), 'regiones/3/perfil.webp');
  // Se llamaba .webp sin serlo: sufijo, para no pisarla.
  assert.equal(rutaWebpDe('miembros/9/perfil.webp'), 'miembros/9/perfil-convertida.webp');
});

test('la ruta sale de la dirección de descarga cuando el registro no la guardó', () => {
  assert.equal(
    rutaDeLaFoto({
      urlFoto:
        'https://firebasestorage.googleapis.com/v0/b/x.appspot.com/o/miembros%2F323%2Fperfil.jpg?alt=media&token=t',
    }),
    'miembros/323/perfil.jpg'
  );
});

test('solo se convierten fotos de perfil activas que no son WebP', () => {
  const base = { tipoEntidad: 'miembro', estado: 'activo', rutaArchivo: 'miembros/1/perfil.jpg' };

  assert.equal(planDeFoto(base, jpg).accion, 'convertir');
  assert.equal(planDeFoto({ ...base, tipoMedio: 'video' }, jpg).accion, 'fuera');
  assert.equal(planDeFoto({ ...base, estado: 'inactivo' }, jpg).accion, 'fuera');
  assert.equal(planDeFoto({ ...base, tipoEntidad: 'producto' }, jpg).accion, 'fuera');
  assert.equal(planDeFoto({ ...base, tipoEntidad: 'principalTarjeta' }, jpg).accion, 'fuera');
  assert.equal(planDeFoto(base, null).motivo, 'el archivo no está en Storage');
});

test('una WebP sin miniatura solo recibe la miniatura; con ella, nada', () => {
  const base = { tipoEntidad: 'seccion', estado: 'activo', rutaArchivo: 'secciones/1/perfil.webp' };

  assert.equal(planDeFoto(base, webp).accion, 'miniatura');
  assert.equal(planDeFoto({ ...base, urlFotoMiniatura: 'https://x' }, webp).accion, 'nada');
  assert.equal(esWebp({ ruta: 'a.webp', tipo: 'image/jpeg' }), false);
});

test('el informe suma por carpeta de perfil y aparta las pesadas de las demás', () => {
  const resumen = resumirStorage([
    { ruta: 'miembros/1/perfil.jpg', bytes: 2_000_000, tipo: 'image/jpeg' },
    { ruta: 'miembros/1/perfil-mini.webp', bytes: 10_000, tipo: 'image/webp' },
    { ruta: 'destacamentos/5/perfil.png', bytes: 800_000, tipo: 'image/png' },
    { ruta: 'principal/muro/foto.jpg', bytes: 3_000_000, tipo: 'image/jpeg' },
    { ruta: 'principal/muro/chica.jpg', bytes: 20_000, tipo: 'image/jpeg' },
    { ruta: 'everest/video.mp4', bytes: 9_000_000, tipo: 'video/mp4' },
  ]);

  assert.equal(resumen.porCarpeta.miembros.archivos, 2);
  assert.equal(resumen.porCarpeta.miembros.noWebp, 1);
  assert.equal(resumen.porCarpeta.destacamentos.bytes, 800_000);
  assert.equal(resumen.total, 2_810_000);
  assert.deepEqual(
    resumen.pesadas.map(({ ruta }) => ruta),
    ['principal/muro/foto.jpg']
  );
});

test('el script no borra nada de Storage', async () => {
  const script = await readFile(
    new URL('../../scripts/convertir-fotos-webp.mjs', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(script, /\.delete\(|deleteFiles|deleteObject/);
  assert.match(script, /const APLICAR = process\.argv\.includes\('--aplicar'\)/);
});
