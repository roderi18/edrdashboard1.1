// ----------------------------------------------------------------------
// LAS INSIGNIAS DE POSICION LOCAL PASAN A RENGLON GENERAL.
//
// Se crearon como `restringido` copiando el molde de la insignia organizacional,
// y no lo son: cualquiera puede comprarlas.
//
// `renglon` y `requiereAprobacion` van juntos a proposito. En el modelo,
// `requiereAprobacion` se deriva de `renglon === 'restringido'` cuando no se dice
// otra cosa, asi que dejar uno de los dos sin cambiar deja el producto a medias:
// sin la etiqueta "Restringido" pero pidiendo aprobacion al comprarlo.
//
//   node corregir-renglon.mjs           -> enseña lo que cambiaria
//   node corregir-renglon.mjs --aplicar -> escribe
// ----------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { Timestamp, getFirestore, FieldValue } from 'firebase-admin/firestore';

const RAIZ = 'C:/Users/rdpr1/OneDrive/Escritorio/next-js';
const APLICAR = process.argv.includes('--aplicar');
const PREFIJO = 'Insignia posición local';

const leerEnv = () => {
  const texto = fs.readFileSync(path.join(RAIZ, '.env.local'), 'utf8');
  const env = {};

  texto.split(/\r?\n/).forEach((linea) => {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) return;
    const corte = limpia.indexOf('=');
    if (corte === -1) return;
    env[limpia.slice(0, corte).trim()] = limpia
      .slice(corte + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  });

  return env;
};

const env = leerEnv();

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) });
}

const db = getFirestore();

const main = async () => {
  const snapshot = await db.collection('productos').get();
  const afectados = snapshot.docs.filter((d) =>
    String(d.data()?.nombre || '').startsWith(PREFIJO)
  );

  console.log(`Productos que empiezan por "${PREFIJO}": ${afectados.length}`);
  console.log(APLICAR ? '\nESCRIBIENDO\n' : '\nSIMULACION (usa --aplicar para escribir)\n');

  let cambiados = 0;

  for (const documento of afectados) {
    const datos = documento.data();
    const yaEstaBien = datos.renglon === 'general' && datos.requiereAprobacion === false;

    console.log(
      `  ${datos.codigo}  ${datos.nombre}  ${datos.renglon}/${datos.requiereAprobacion}` +
        (yaEstaBien ? '  (ya estaba bien)' : '  ->  general/false')
    );

    if (yaEstaBien || !APLICAR) continue;

    await documento.ref.update({
      renglon: 'general',
      requiereAprobacion: false,
      fechaActualizacion: Timestamp.now(),
    });

    const auditRef = db.collection('auditoria_sistema').doc();

    await auditRef.set({
      idAuditoria: auditRef.id,
      modulo: 'tienda',
      accion: 'producto_actualizado',
      descripcion: `${datos.nombre} (${datos.codigo}) pasa de renglon restringido a general.`,
      resultado: 'exitoso',
      severidad: 'informativa',
      entidad: {
        tipo: 'producto',
        id: documento.id,
        nombre: datos.nombre,
        ruta: `/dashboard/product/${documento.id}`,
      },
      antes: { renglon: datos.renglon, requiereAprobacion: datos.requiereAprobacion },
      despues: { renglon: 'general', requiereAprobacion: false },
      realizadoPor: { nombre: 'Correccion de catalogo', origen: 'script' },
      origen: 'script',
      metadatos: { ambito: 'tienda', lote: 'renglon-posiciones-locales' },
      fecha: new Date().toISOString(),
      fechaServidor: FieldValue.serverTimestamp(),
    });

    cambiados += 1;
  }

  console.log(`\nCambiados: ${cambiados}`);
};

main().catch((error) => {
  console.error('FALLO:', error.message);
  process.exit(1);
});
