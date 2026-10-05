#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const DIRECTORIO_FIREBASE_TOOLS = join(
  process.env.APPDATA || '',
  'npm',
  'node_modules',
  'firebase-tools',
  'lib'
);

const { getGlobalDefaultAccount } = require(join(DIRECTORIO_FIREBASE_TOOLS, 'auth.js'));
const { requireAuth } = require(join(DIRECTORIO_FIREBASE_TOOLS, 'requireAuth.js'));
const { Client } = require(join(DIRECTORIO_FIREBASE_TOOLS, 'apiv2.js'));

const argumentos = new Map(
  process.argv.slice(2).map((argumento) => {
    const [clave, ...partes] = argumento.replace(/^--/, '').split('=');
    return [clave, partes.length ? partes.join('=') : true];
  })
);

const proyectoOrigen = String(argumentos.get('origen') || 'systexploradores');
const proyectoDestino = String(argumentos.get('destino') || 'systexploradores-dev');
const aplicar = argumentos.has('aplicar');
const confirmar = String(argumentos.get('confirmar') || '');
const permitirDestinoConDatos = argumentos.has('permitir-destino-con-datos');
const rutaRespaldoVerificacion = argumentos.get('verificar-respaldo')
  ? String(argumentos.get('verificar-respaldo'))
  : '';
const TAMANO_LOTE = 200;

if (proyectoOrigen === proyectoDestino) {
  throw new Error('El proyecto de origen y el proyecto de destino no pueden ser el mismo.');
}

if (!/-(dev|qa)$/.test(proyectoDestino)) {
  throw new Error(
    `Por seguridad, este script solo acepta destinos terminados en -dev o -qa: ${proyectoDestino}`
  );
}

if (aplicar && confirmar !== proyectoDestino) {
  throw new Error(`Para escribir, agregue --confirmar=${proyectoDestino}`);
}

const cuenta = getGlobalDefaultAccount();
if (!cuenta) {
  throw new Error('Firebase CLI no tiene una sesión activa. Ejecute firebase login.');
}

await requireAuth({
  project: proyectoOrigen,
  user: cuenta.user,
  tokens: cuenta.tokens,
});

const cliente = new Client({
  urlPrefix: 'https://firestore.googleapis.com',
  apiVersion: 'v1',
});

function baseDocumentos(proyecto) {
  return `projects/${proyecto}/databases/(default)/documents`;
}

async function listarIdsColecciones(proyecto, rutaDocumento = '') {
  const ruta = rutaDocumento
    ? `${baseDocumentos(proyecto)}/${rutaDocumento}:listCollectionIds`
    : `${baseDocumentos(proyecto)}:listCollectionIds`;
  const ids = [];
  let pageToken;

  do {
    const respuesta = await cliente.post(ruta, {
      pageSize: 1000,
      ...(pageToken ? { pageToken } : {}),
    });
    ids.push(...(respuesta.body.collectionIds || []));
    pageToken = respuesta.body.nextPageToken;
  } while (pageToken);

  return ids.sort();
}

async function listarDocumentos(proyecto, rutaColeccion) {
  const ultimoSeparador = rutaColeccion.lastIndexOf('/');
  const rutaPadre = ultimoSeparador === -1 ? '' : rutaColeccion.slice(0, ultimoSeparador);
  const idColeccion = ultimoSeparador === -1
    ? rutaColeccion
    : rutaColeccion.slice(ultimoSeparador + 1);
  const ruta = rutaPadre
    ? `${baseDocumentos(proyecto)}/${rutaPadre}/${idColeccion}`
    : `${baseDocumentos(proyecto)}/${idColeccion}`;
  const documentos = [];
  let pageToken;

  do {
    const respuesta = await cliente.get(ruta, {
      queryParams: {
        pageSize: 1000,
        showMissing: true,
        ...(pageToken ? { pageToken } : {}),
      },
    });
    documentos.push(...(respuesta.body.documents || []));
    pageToken = respuesta.body.nextPageToken;
  } while (pageToken);

  return documentos;
}

function rutaRelativaDocumento(documento) {
  return documento.name.split('/documents/')[1];
}

function serializarEstable(valor) {
  if (Array.isArray(valor)) {
    return `[${valor.map(serializarEstable).join(',')}]`;
  }
  if (valor && typeof valor === 'object') {
    return `{${Object.keys(valor)
      .sort()
      .map((clave) => `${JSON.stringify(clave)}:${serializarEstable(valor[clave])}`)
      .join(',')}}`;
  }
  return JSON.stringify(valor);
}

function firmaDocumento(ruta, fields = {}) {
  return createHash('sha256').update(`${ruta}\n${serializarEstable(fields)}`).digest('hex');
}

async function inventariarProyecto(proyecto) {
  const documentos = [];
  const coleccionesRaiz = await listarIdsColecciones(proyecto);
  const pendientes = [...coleccionesRaiz];

  while (pendientes.length) {
    const loteColecciones = pendientes.splice(0, 20);
    const grupos = await Promise.all(
      loteColecciones.map(async (rutaColeccion) => ({
        rutaColeccion,
        documentos: await listarDocumentos(proyecto, rutaColeccion),
      }))
    );

    for (const grupo of grupos) {
      for (let indice = 0; indice < grupo.documentos.length; indice += 20) {
        const loteDocumentos = grupo.documentos.slice(indice, indice + 20);
        const subcoleccionesPorDocumento = await Promise.all(
          loteDocumentos.map(async (documento) => {
            const ruta = rutaRelativaDocumento(documento);
            if (documento.fields) {
              documentos.push({
                ruta,
                fields: documento.fields,
                firma: firmaDocumento(ruta, documento.fields),
              });
            }
            return {
              ruta,
              ids: await listarIdsColecciones(proyecto, ruta),
            };
          })
        );

        for (const resultado of subcoleccionesPorDocumento) {
          pendientes.push(...resultado.ids.map((id) => `${resultado.ruta}/${id}`));
        }
      }
    }
  }

  documentos.sort((a, b) => a.ruta.localeCompare(b.ruta));
  return { coleccionesRaiz, documentos };
}

function resumen(inventario) {
  const firma = createHash('sha256');
  for (const documento of inventario.documentos) {
    firma.update(`${documento.ruta}:${documento.firma}\n`);
  }
  return {
    coleccionesRaiz: inventario.coleccionesRaiz.length,
    documentos: inventario.documentos.length,
    firma: firma.digest('hex'),
  };
}

function tipoResumido(valor) {
  if (valor === null) return 'null';
  if (Array.isArray(valor)) return `array(${valor.length})`;
  if (typeof valor === 'string') return `string(${valor.length})`;
  if (typeof valor === 'object') return `object(${Object.keys(valor).sort().join(',')})`;
  return typeof valor;
}

function primeraDiferencia(origen, destino, ruta = 'fields') {
  if (Object.is(origen, destino)) return null;
  if (
    origen === null || destino === null ||
    typeof origen !== 'object' || typeof destino !== 'object'
  ) {
    return { ruta, origen: tipoResumido(origen), destino: tipoResumido(destino) };
  }
  if (Array.isArray(origen) !== Array.isArray(destino)) {
    return { ruta, origen: tipoResumido(origen), destino: tipoResumido(destino) };
  }
  const claves = [...new Set([...Object.keys(origen), ...Object.keys(destino)])].sort();
  for (const clave of claves) {
    if (!(clave in origen) || !(clave in destino)) {
      return {
        ruta: `${ruta}.${clave}`,
        origen: clave in origen ? tipoResumido(origen[clave]) : 'ausente',
        destino: clave in destino ? tipoResumido(destino[clave]) : 'ausente',
      };
    }
    const diferencia = primeraDiferencia(origen[clave], destino[clave], `${ruta}.${clave}`);
    if (diferencia) return diferencia;
  }
  return null;
}

function diagnosticarDiferencias(origen, destino) {
  const destinoPorRuta = new Map(destino.documentos.map((documento) => [documento.ruta, documento]));
  const diferencias = [];
  for (const documentoOrigen of origen.documentos) {
    const documentoDestino = destinoPorRuta.get(documentoOrigen.ruta);
    if (!documentoDestino) {
      diferencias.push({ documento: documentoOrigen.ruta, diferencia: 'documento ausente' });
    } else if (documentoOrigen.firma !== documentoDestino.firma) {
      diferencias.push({
        documento: documentoOrigen.ruta,
        diferencia: primeraDiferencia(documentoOrigen.fields, documentoDestino.fields),
      });
    }
    if (diferencias.length >= 20) break;
  }
  console.log('Diagnóstico de diferencias (sin valores):', JSON.stringify(diferencias, null, 2));
}

async function escribirDocumentos(documentos) {
  for (let indice = 0; indice < documentos.length; indice += TAMANO_LOTE) {
    const lote = documentos.slice(indice, indice + TAMANO_LOTE);
    await cliente.post(`projects/${proyectoDestino}/databases/(default)/documents:commit`, {
      writes: lote.map((documento) => ({
        update: {
          name: `${baseDocumentos(proyectoDestino)}/${documento.ruta}`,
          fields: documento.fields,
        },
      })),
    });
    console.log(`Copiados ${Math.min(indice + lote.length, documentos.length)}/${documentos.length} documentos`);
  }
}

async function guardarRespaldo(inventario) {
  const marcaTiempo = new Date().toISOString().replace(/[:.]/g, '-');
  const ruta = join(
    dirname(dirname(dirname(fileURLToPath(import.meta.url)))),
    'docs',
    'backups',
    `firestore-${proyectoOrigen}-${marcaTiempo}.json.gz`
  );
  const contenido = {
    formato: 1,
    proyecto: proyectoOrigen,
    generadoEn: new Date().toISOString(),
    coleccionesRaiz: inventario.coleccionesRaiz,
    documentos: inventario.documentos.map(({ ruta: rutaDocumento, fields }) => ({
      ruta: rutaDocumento,
      fields,
    })),
  };
  await mkdir(dirname(ruta), { recursive: true });
  await writeFile(ruta, gzipSync(JSON.stringify(contenido), { level: 9 }));
  console.log(`Respaldo local comprimido: ${ruta}`);
}

async function cargarRespaldo(ruta) {
  const comprimido = await readFile(ruta);
  const respaldo = JSON.parse(gunzipSync(comprimido).toString('utf8'));
  const documentos = (respaldo.documentos || []).map(({ ruta: rutaDocumento, fields }) => ({
    ruta: rutaDocumento,
    fields,
    firma: firmaDocumento(rutaDocumento, fields),
  }));
  documentos.sort((a, b) => a.ruta.localeCompare(b.ruta));
  return { coleccionesRaiz: respaldo.coleccionesRaiz || [], documentos };
}

console.log(`Origen:  ${proyectoOrigen}`);
console.log(`Destino: ${proyectoDestino}`);
console.log(`Modo:    ${aplicar ? 'ESCRITURA' : 'SOLO LECTURA'}`);

const inventarioOrigen = rutaRespaldoVerificacion
  ? await cargarRespaldo(rutaRespaldoVerificacion)
  : await inventariarProyecto(proyectoOrigen);
const resumenOrigen = resumen(inventarioOrigen);
console.log(
  rutaRespaldoVerificacion ? 'Respaldo cargado:' : 'Origen inventariado:',
  JSON.stringify(resumenOrigen, null, 2)
);

const inventarioDestinoAntes = await inventariarProyecto(proyectoDestino);
const resumenDestinoAntes = resumen(inventarioDestinoAntes);
console.log('Destino antes:', JSON.stringify(resumenDestinoAntes, null, 2));

if (resumenOrigen.firma !== resumenDestinoAntes.firma) {
  diagnosticarDiferencias(inventarioOrigen, inventarioDestinoAntes);
}

if (!aplicar) {
  if (rutaRespaldoVerificacion) {
    if (
      resumenOrigen.documentos !== resumenDestinoAntes.documentos ||
      resumenOrigen.firma !== resumenDestinoAntes.firma
    ) {
      throw new Error('El destino no coincide con el respaldo indicado.');
    }
    console.log('VERIFICACIÓN COMPLETA: desarrollo coincide con el respaldo de origen.');
    process.exit(0);
  }
  console.log(`Plan listo. Para ejecutar: --aplicar --confirmar=${proyectoDestino}`);
  process.exit(0);
}

if (inventarioDestinoAntes.documentos.length && !permitirDestinoConDatos) {
  throw new Error(
    'El destino ya contiene documentos. Se detuvo para no sobrescribirlos. ' +
    'Revise el inventario o use --permitir-destino-con-datos conscientemente.'
  );
}

if (!rutaRespaldoVerificacion) {
  await guardarRespaldo(inventarioOrigen);
}
await escribirDocumentos(inventarioOrigen.documentos);

const inventarioDestinoDespues = await inventariarProyecto(proyectoDestino);
const resumenDestinoDespues = resumen(inventarioDestinoDespues);
console.log('Destino después:', JSON.stringify(resumenDestinoDespues, null, 2));

if (
  resumenOrigen.documentos !== resumenDestinoDespues.documentos ||
  resumenOrigen.firma !== resumenDestinoDespues.firma
) {
  throw new Error('La verificación final no coincide: cantidad o firma diferente.');
}

console.log('COPIA VERIFICADA: el destino coincide con el origen documento por documento.');

