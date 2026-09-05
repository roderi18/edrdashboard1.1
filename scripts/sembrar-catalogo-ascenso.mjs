/**
 * Registra en Firestore el catálogo de premios: las divisiones, sus carpetas y
 * los documentos que contienen.
 *
 * El árbol que la aplicación pinta sale de `src/_mock/_awards.js`, que se lee en
 * el navegador. Firestore no lo tenía: la colección `itemsAscenso` solo recibía
 * un premio suelto cuando alguien guardaba su progreso, así que el catálogo
 * existía a medias y solo para lo ya usado. Este script lo deja completo, que es
 * lo que permite consultarlo desde fuera del navegador (informes, respaldos, la
 * API).
 *
 * Escribe dos colecciones, con el MISMO id que usa la aplicación —el de la ruta,
 * `exploradores__premios-de-destreza-plata__albanileria`—, para que lo que se
 * guarde aquí y el progreso del miembro hablen de lo mismo:
 *
 *   carpetasAscenso/{id}  las divisiones y sus carpetas, con su padre
 *   itemsAscenso/{id}     los premios, con su división y su carpeta
 *
 * Es idempotente: usa `merge`, así que volver a pasarlo no duplica ni borra lo
 * que ya haya. Tampoco elimina nada: si un premio desaparece del catálogo, su
 * documento se queda y hay que quitarlo a mano.
 *
 * Uso:
 *   node scripts/sembrar-catalogo-ascenso.mjs             # simulacro, no escribe
 *   node scripts/sembrar-catalogo-ascenso.mjs --apply     # escribe de verdad
 *
 * Necesita FIREBASE_SERVICE_ACCOUNT: la misma credencial que usa el servidor, que
 * ya vive en `.env.local`. Ese archivo lo carga Next por su cuenta, pero `node` a
 * secas no, asi que el script lo lee el mismo (ver mas abajo).
 */

import fs from 'node:fs';
import { register } from 'node:module';

register(new URL('../tests/soporte/resolver-alias-src.mjs', import.meta.url));

// La credencial esta donde ya estaba: no se pide copiarla a mano al entorno solo
// para pasar un script. Se respeta lo que ya venga puesto en el entorno, que es
// como se pasaria otra credencial sin tocar los archivos.
const cargarEntornoLocal = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return;

  for (const nombre of ['.env.local', '.env']) {
    const ruta = new URL(`../${nombre}`, import.meta.url);

    if (!fs.existsSync(ruta)) continue;

    try {
      process.loadEnvFile(ruta);
    } catch {
      // Un .env con una linea rara no puede tumbar el script: si de ahi no sale
      // la credencial, mas abajo se avisa igual.
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT) return;
  }
};

cargarEntornoLocal();

const aplicar = process.argv.slice(2).includes('--apply');

const { _awards } = await import('src/_mock/_awards.js');

const ID_RAIZ_ASCENSO = 'sistema-de-ascenso';
const ID_RAIZ_ACADEMIA = 'academia-ministerial';

const porId = new Map(_awards.map((nodo) => [nodo.id, nodo]));

const caminoDe = (nodo) => {
  const ruta = [];
  let actual = nodo;

  while (actual) {
    ruta.unshift(actual);
    actual = porId.get(actual.parentId);
  }

  return ruta;
};

// La división es el tramo que sigue a la raíz; el grupo, el padre directo.
const describir = (nodo) => {
  const ruta = caminoDe(nodo);
  const raiz = ruta[0];
  const esAscenso = raiz?.id === ID_RAIZ_ASCENSO;
  const division = esAscenso ? ruta[1] : null;
  const padre = porId.get(nodo.parentId);

  return {
    sistema: esAscenso ? 'sistemaAscenso' : 'academia',
    idDivision: division?.id ?? '',
    nombreDivision: division?.name ?? '',
    idGrupo: padre?.id ?? '',
    nombreGrupo: padre?.name ?? '',
    ruta: ruta.map((tramo) => tramo.name).join(' / '),
    nivel: ruta.length - 1,
  };
};

const deLasDosRaices = (nodo) => {
  const raiz = caminoDe(nodo)[0];

  return raiz?.id === ID_RAIZ_ASCENSO || raiz?.id === ID_RAIZ_ACADEMIA;
};

const nodos = _awards.filter(deLasDosRaices);
const carpetas = nodos.filter((nodo) => nodo.type === 'folder');
const premios = nodos.filter((nodo) => nodo.type !== 'folder');

const documentoDeCarpeta = (nodo) => {
  const info = describir(nodo);

  return {
    coleccion: 'carpetasAscenso',
    id: nodo.id,
    datos: {
      id: nodo.id,
      nombre: nodo.name,
      idPadre: nodo.parentId ?? '',
      sistema: info.sistema,
      idDivision: info.idDivision,
      nombreDivision: info.nombreDivision,
      ruta: info.ruta,
      nivel: info.nivel,
    },
  };
};

const documentoDePremio = (nodo) => {
  const info = describir(nodo);

  return {
    coleccion: 'itemsAscenso',
    id: nodo.id,
    datos: {
      id: nodo.id,
      nombre: nodo.name,
      sistema: info.sistema,
      idDivision: info.idDivision,
      nombreDivision: info.nombreDivision,
      idGrupo: info.idGrupo,
      nombreGrupo: info.nombreGrupo,
      ruta: info.ruta,
    },
  };
};

const escrituras = [...carpetas.map(documentoDeCarpeta), ...premios.map(documentoDePremio)];

console.log('CATALOGO DE PREMIOS');
console.log('  divisiones y carpetas :', carpetas.length);
console.log('  documentos            :', premios.length);
console.log('  total a escribir      :', escrituras.length);
console.log('');

const porDivision = new Map();

premios.forEach((nodo) => {
  const { nombreDivision } = describir(nodo);
  const clave = nombreDivision || '(Academia Ministerial)';

  porDivision.set(clave, (porDivision.get(clave) || 0) + 1);
});

[...porDivision].sort().forEach(([division, cuantos]) => {
  console.log(`  ${division.padEnd(24)} ${String(cuantos).padStart(4)} premios`);
});

console.log('');
console.log('Ejemplos de lo que se escribiria:');
[carpetas[1], premios[0], premios[premios.length - 1]].filter(Boolean).forEach((nodo) => {
  const doc = nodo.type === 'folder' ? documentoDeCarpeta(nodo) : documentoDePremio(nodo);

  console.log(`  ${doc.coleccion}/${doc.id}`);
  console.log(`    ${doc.datos.ruta}`);
});

if (!aplicar) {
  console.log('');
  console.log('SIMULACRO: no se escribio nada. Repite con --apply para guardarlo.');
  process.exit(0);
}

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('');
  console.error('Falta FIREBASE_SERVICE_ACCOUNT: no esta en el entorno ni en .env.local.');
  console.error('No se escribio nada.');
  process.exit(1);
}

const { cert, getApps, initializeApp } = await import('firebase-admin/app');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
}

const db = getFirestore();

// Firestore admite 500 operaciones por lote; se parte en tandas de 400 para
// dejar margen.
const TAMANO_LOTE = 400;
let escritos = 0;

for (let desde = 0; desde < escrituras.length; desde += TAMANO_LOTE) {
  const tanda = escrituras.slice(desde, desde + TAMANO_LOTE);
  const lote = db.batch();

  tanda.forEach(({ coleccion, id, datos }) => {
    lote.set(
      db.collection(coleccion).doc(id),
      { ...datos, actualizadoEnServidor: FieldValue.serverTimestamp() },
      { merge: true }
    );
  });

  // eslint-disable-next-line no-await-in-loop
  await lote.commit();
  escritos += tanda.length;

  console.log(`  escritos ${escritos}/${escrituras.length}`);
}

console.log('');
console.log('Listo.');
