// ----------------------------------------------------------------------
// MARCA LOS DESTACAMENTOS CON LICENCIA RRI TRaC QUE HABILITA LA CUOTA DE
// RD$1,500 en 2027 (colección `licenciasRriTrac`, por id del padrón).
//
// Se pasan NÚMEROS de destacamento; el script busca su id en el padrón. No
// guarda nombres de titulares (el repositorio no lleva datos de personas):
// esos los completa la Oficina Nacional desde su pantalla.
//
//   node --env-file=.env.local scripts/licencias-rri-trac.mjs 97 179            (solo muestra)
//   node --env-file=.env.local scripts/licencias-rri-trac.mjs 97 179 --aplicar  (escribe)
// ----------------------------------------------------------------------
import { FieldValue } from 'firebase-admin/firestore';

import { db } from '../src/server/firebase.mjs';
import { leerPadron } from '../src/server/padron.mjs';

const aplicar = process.argv.includes('--aplicar');
const numeros = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
if (!numeros.length) {
  console.error('Indica los números de destacamento: 97 179');
  process.exit(1);
}

const padron = await leerPadron();
const sinCeros = (n) => String(n).replace(/^0+/, '');

for (const numero of numeros) {
  const d = padron.find((x) => sinCeros(x.numero) === sinCeros(numero));
  if (!d) {
    console.log(`#${numero}: no está en el padrón.`);
    continue;
  }
  const ref = db().collection('licenciasRriTrac').doc(d.id);
  const actual = (await ref.get()).data();
  const licencias = Array.isArray(actual?.licencias) ? actual.licencias : [];
  if (licencias.some((l) => l.habilita2027 === true)) {
    console.log(`#${numero} (${d.nombre}, id ${d.id}): ya tiene una licencia que habilita 2027.`);
    continue;
  }
  console.log(
    `#${numero} (${d.nombre}, id ${d.id}): ${aplicar ? 'se marca' : 'se marcaría'} con licencia activa.`
  );
  if (aplicar) {
    await ref.set(
      {
        destacamentoId: d.id,
        numero: d.numero,
        licencias: [
          ...licencias,
          {
            titular: '',
            fechaActivacion: null,
            estado: 'activa',
            habilita2027: true,
            nota: 'Lista de la Oficina Nacional (oct. 2026)',
          },
        ],
        actualizadoEn: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
}
if (!aplicar) console.log('\nNada se escribió. Repite con --aplicar para guardarlo.');
process.exit(0);
