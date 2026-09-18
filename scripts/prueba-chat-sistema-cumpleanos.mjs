// ----------------------------------------------------------------------
// PRUEBA A MANO DEL CHAT DE SISTEMA: EL CUMPLEAÑOS DE UNA PERSONA.
//
// Lanza, para UN miembro, lo mismo que la funcion programada de cada mañana
// (`netlify/functions/cumpleanos-diarios.mjs`): el mensaje de Sistema a todas las
// personas con cuenta de su destacamento, con los dias que de verdad le faltan.
// Lee y escribe con las MISMAS piezas que la funcion (`cumpleanos-lecturas.mjs`,
// `chat-sistema-envio.mjs`), asi que lo que pasa aqui es lo que pasara alli.
//
// El envio queda en el registro marcado como "prueba". Es idempotente: el id del
// mensaje lleva la fecha, y lanzarlo dos veces el mismo dia no lo repite.
//
//   node scripts/prueba-chat-sistema-cumpleanos.mjs 367            -> solo muestra el reparto
//   node scripts/prueba-chat-sistema-cumpleanos.mjs 367 --enviar   -> escribe
//   ... 367 --enviar --reenviar  -> rehace el aviso del dia que ya estaba (tras cambiar
//                                   su formato) y lo deja otra vez como no leido
//   ... 367 --enviar --solo-contenido  -> corrige texto y tarjeta del aviso del dia que ya
//                                         estaba, sin cambiar su hora ni avisar otra vez
// ----------------------------------------------------------------------

import fs from 'node:fs';
import process from 'node:process';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import { enviarCumpleanosPorChatDeSistema } from '../src/server/chat-sistema-envio.mjs';
import {
  idDelMiembro,
  nombreDelMiembro,
  fechaDeNacimiento,
  diasHastaCumpleanos,
} from '../src/server/cumpleanos-core.mjs';
import {
  fechaClaveLocal,
  repartoDelChatDeCumpleanos,
} from '../src/server/chat-sistema-cumpleanos.mjs';
import {
  leerMiembros,
  leerFotosDeMiembros,
  leerCuentasPorMiembro,
  leerNombresDeDestacamentos,
} from '../src/server/cumpleanos-lecturas.mjs';

const ENVIAR = process.argv.includes('--enviar');
const REENVIAR = process.argv.includes('--reenviar');
const SOLO_CONTENIDO = process.argv.includes('--solo-contenido');
const idPedido = process.argv.slice(2).find((argumento) => /^\d+$/.test(argumento));

if (!idPedido) {
  console.error('Uso: node scripts/prueba-chat-sistema-cumpleanos.mjs <idMiembros> [--enviar]');
  process.exit(1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((linea) => linea.includes('=') && !linea.trim().startsWith('#'))
    .map((linea) => {
      const corte = linea.indexOf('=');
      return [
        linea.slice(0, corte).trim(),
        linea
          .slice(corte + 1)
          .trim()
          .replace(/^["']|["']$/g, ''),
      ];
    })
);

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) });
}

const db = getFirestore();
const hoy = new Date();

const [miembros, cuentasPorMiembro, fotos, nombresDeDestacamentos] = await Promise.all([
  leerMiembros(),
  leerCuentasPorMiembro(db),
  leerFotosDeMiembros(db),
  leerNombresDeDestacamentos(),
]);

const miembro = miembros.find((fila) => idDelMiembro(fila) === idPedido);

if (!miembro) {
  console.error(`No hay ningun miembro ${idPedido} en el padron.`);
  process.exit(1);
}

const dias = diasHastaCumpleanos(fechaDeNacimiento(miembro), hoy);

if (dias === null) {
  console.error(`${nombreDelMiembro(miembro)} no tiene fecha de nacimiento.`);
  process.exit(1);
}

const cumpleaneros = [{ miembro, dias }];
const [envio] = repartoDelChatDeCumpleanos({
  cumpleaneros,
  miembros,
  cuentasPorMiembro,
  fotos,
  nombresDeDestacamentos,
  fechaClave: fechaClaveLocal(hoy),
});

console.info(
  `${nombreDelMiembro(miembro)} (${idPedido}) · destacamento ${envio.nombreDestacamento || envio.idDestacamento} · faltan ${dias} dia(s)`
);
console.info(`${envio.mensajes.length} mensaje(s):`);
envio.mensajes.forEach((mensaje) =>
  console.info(`  - ${mensaje.idMiembros} ${mensaje.nombre} (${mensaje.idMensaje})`)
);

if (!ENVIAR) {
  console.info('\nSolo simulacion. Para escribir, repite con --enviar.');
  process.exit(0);
}

const { registros, errores } = await enviarCumpleanosPorChatDeSistema({
  db,
  FieldValue,
  miembros,
  cuentasPorMiembro,
  fotos,
  nombresDeDestacamentos,
  hoy,
  cumpleaneros,
  origen: 'prueba',
  reenviar: REENVIAR,
  soloContenido: SOLO_CONTENIDO,
});

registros.forEach((registro) =>
  console.info(
    registro.corregidos
      ? `\nCorregidos: ${registro.cantidadMensajes} mensaje(s) de ${registro.nombreDestacamento}, sin volver a avisar`
      : `\nEnviado: ${registro.cantidadMensajes} mensaje(s) a ${registro.nombreDestacamento} · registro ${registro.id}`
  )
);
if (!registros.length && !errores.length) {
  console.info('\nNada nuevo: los mensajes de hoy ya estaban enviados.');
}
errores.forEach((error) => console.error('Error:', error));
process.exit(errores.length ? 1 : 0);
