#!/usr/bin/env node

import { cert, deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import {
  DEFINICIONES_COLECCIONES,
  obtenerPlanMigracionColecciones,
} from '../../src/config/esquema-firestore.mjs';
import { normalizarCamposFirestore } from '../../src/config/campos-firestore.mjs';

const argumentos = new Map(
  process.argv.slice(2).map((argumento) => {
    const [clave, ...resto] = argumento.replace(/^--/, '').split('=');
    return [clave, resto.length ? resto.join('=') : true];
  })
);

const aplicar = argumentos.has('aplicar');
const sobrescribir = argumentos.has('sobrescribir');
const normalizarCampos = argumentos.has('normalizar-campos');
const confirmacion = argumentos.get('confirmar');
const solo = new Set(
  String(argumentos.get('solo') || '')
    .split(',')
    .map((valor) => valor.trim())
    .filter(Boolean)
);

if (aplicar && confirmacion !== 'MIGRAR_ESQUEMA_FIRESTORE') {
  throw new Error(
    'Para escribir debes agregar --aplicar --confirmar=MIGRAR_ESQUEMA_FIRESTORE.'
  );
}

const leerCuentaServicio = (nombre, respaldo) => {
  const contenido = process.env[nombre] || (respaldo ? process.env[respaldo] : '');
  if (!contenido) throw new Error(`Falta la variable ${nombre}${respaldo ? ` o ${respaldo}` : ''}.`);

  const cuenta = JSON.parse(contenido);
  if (typeof cuenta.private_key === 'string') {
    cuenta.private_key = cuenta.private_key.replace(/\\n/g, '\n');
  }
  return cuenta;
};

const cuentaOrigen = leerCuentaServicio('FIREBASE_SERVICE_ACCOUNT_ORIGEN', 'FIREBASE_SERVICE_ACCOUNT');
const proyectoOrigen = String(argumentos.get('origen') || cuentaOrigen.project_id);
const proyectoDestino = String(argumentos.get('destino') || proyectoOrigen);

const cuentaDestino =
  proyectoDestino === proyectoOrigen
    ? cuentaOrigen
    : leerCuentaServicio('FIREBASE_SERVICE_ACCOUNT_DESTINO');

const appOrigen = initializeApp(
  { credential: cert(cuentaOrigen), projectId: proyectoOrigen },
  `migracion-origen-${Date.now()}`
);
const appDestino =
  proyectoDestino === proyectoOrigen
    ? appOrigen
    : initializeApp(
        { credential: cert(cuentaDestino), projectId: proyectoDestino },
        `migracion-destino-${Date.now()}`
      );

const dbOrigen = getFirestore(appOrigen);
const dbDestino = getFirestore(appDestino);

const mapaNombres = new Map();
for (const definicion of Object.values(DEFINICIONES_COLECCIONES)) {
  for (const heredado of definicion.heredados) mapaNombres.set(heredado, definicion.canonico);
}

const nombreCanonico = (nombre) => mapaNombres.get(nombre) || nombre;

const plan = obtenerPlanMigracionColecciones().filter(
  ({ clave, origen }) => !solo.size || solo.has(clave) || solo.has(origen)
);

const resumen = {
  colecciones: 0,
  documentosOrigen: 0,
  documentosEscritos: 0,
  documentosIguales: 0,
  documentosExistentes: 0,
  conflictosCampos: 0,
  errores: 0,
};

const serializarComparable = (valor) => {
  if (valor === null || valor === undefined) return valor;
  if (Array.isArray(valor)) return valor.map(serializarComparable);
  if (typeof valor?.toDate === 'function') return { __fecha: valor.toDate().toISOString() };
  if (typeof valor?.path === 'string' && valor?.firestore) return { __referencia: valor.path };
  if (typeof valor !== 'object') return valor;
  if (typeof valor.toBase64 === 'function') return { __bytes: valor.toBase64() };
  if ('latitude' in valor && 'longitude' in valor) {
    return { __geopunto: [valor.latitude, valor.longitude] };
  }
  return Object.fromEntries(
    Object.entries(valor)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([clave, contenido]) => [clave, serializarComparable(contenido)])
  );
};

const convertirReferencias = (valor) => {
  if (Array.isArray(valor)) return valor.map(convertirReferencias);
  if (!valor || typeof valor !== 'object') return valor;
  if (typeof valor?.path === 'string' && valor?.firestore) return dbDestino.doc(valor.path);
  if (typeof valor.toDate === 'function' || typeof valor.toBase64 === 'function') return valor;
  if ('latitude' in valor && 'longitude' in valor) return valor;
  if (valor.constructor?.name !== 'Object') return valor;
  return Object.fromEntries(
    Object.entries(valor).map(([clave, contenido]) => [clave, convertirReferencias(contenido)])
  );
};

const datosCanonicos = (datos, ruta) => {
  if (!normalizarCampos) return convertirReferencias(datos);

  const conflictos = [];
  const convertidos = convertirReferencias(datos);
  const normalizados = normalizarCamposFirestore(convertidos, conflictos);
  if (conflictos.length) {
    resumen.conflictosCampos += conflictos.length;
    throw new Error(
      `Conflicto de campos en ${ruta}: ${conflictos.map((item) => item.ruta).join(', ')}`
    );
  }
  return normalizados;
};

const copiarColeccion = async (coleccionOrigen, coleccionDestino) => {
  resumen.colecciones += 1;
  const instantanea = await coleccionOrigen.get();

  for (const documento of instantanea.docs) {
    resumen.documentosOrigen += 1;
    const destino = coleccionDestino.doc(documento.id);
    const datos = datosCanonicos(documento.data(), documento.ref.path);
    const existente = await destino.get();

    if (existente.exists) {
      const actual = JSON.stringify(serializarComparable(existente.data()));
      const nuevo = JSON.stringify(serializarComparable(datos));
      if (actual === nuevo) {
        resumen.documentosIguales += 1;
      } else if (!sobrescribir) {
        resumen.documentosExistentes += 1;
        throw new Error(
          `El destino ${destino.path} ya existe con datos distintos. Revisa antes de usar --sobrescribir.`
        );
      }
    }

    if (!existente.exists || sobrescribir) {
      await destino.set(datos, { merge: false });
      resumen.documentosEscritos += 1;
    }

    const subcolecciones = await documento.ref.listCollections();
    for (const subcoleccion of subcolecciones) {
      await copiarColeccion(
        subcoleccion,
        destino.collection(nombreCanonico(subcoleccion.id))
      );
    }
  }
};

try {
  console.log(`Origen: ${proyectoOrigen}`);
  console.log(`Destino: ${proyectoDestino}`);
  console.log(`Modo: ${aplicar ? 'APLICAR' : 'SOLO LECTURA'}`);
  console.log(`Campos: ${normalizarCampos ? 'NORMALIZAR' : 'CONSERVAR'}`);
  console.log(`Colecciones planificadas: ${plan.length}`);

  for (const item of plan) {
    const origen = dbOrigen.collection(item.origen);
    const conteo = await origen.count().get();
    const cantidad = conteo.data().count;
    console.log(`${item.origen} -> ${item.destino}: ${cantidad} documentos raiz`);

    if (aplicar && cantidad > 0) {
      await copiarColeccion(origen, dbDestino.collection(item.destino));
    }
  }
} catch (error) {
  resumen.errores += 1;
  console.error(error?.stack || error);
  process.exitCode = 1;
} finally {
  console.log(JSON.stringify(resumen, null, 2));
  if (appDestino !== appOrigen) await deleteApp(appDestino);
  await deleteApp(appOrigen);
}

