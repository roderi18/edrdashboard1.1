import fs from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// El codigo REAL, por el mismo alias con el que lo importa la aplicacion.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// ----------------------------------------------------------------------
// CARGA AUTOMÁTICA DE LA BANDEJA DE ACTUALIZACIONES.
//
// Con el interruptor encendido, lo que llega desde la landing se carga solo y se
// avisa. Lo que no puede romperse: los envíos que ya esperaban al encenderlo no
// se vuelcan de golpe; un destacamento nuevo nunca se carga solo (la manual
// tampoco lo crea); un envío reservado por otra sesión no se toma dos veces; y
// tras varios fallos se deja para la carga manual.
// ----------------------------------------------------------------------

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

const { debeCargarseSolo, INTENTOS_MAXIMOS, RESERVA_MS } = await import(
  '../../src/utils/carga-automatica-actualizaciones.mjs'
);

const DESDE = Date.parse('2026-09-28T10:00:00Z');
const AHORA = DESDE + 60 * 60 * 1000;
const activa = { activa: true, desde: DESDE };
const fila = (extra = {}) => ({
  estado: 'pendiente',
  destacamento: { id: '18' },
  fechaEnvio: new Date(DESDE + 1000),
  ...extra,
});

test('con el interruptor apagado no se carga nada solo', () => {
  assert.equal(debeCargarseSolo(fila(), { activa: false, desde: DESDE }, AHORA), false);
});

test('se carga solo lo que llegó después de encenderlo', () => {
  assert.equal(debeCargarseSolo(fila(), activa, AHORA), true);
  assert.equal(debeCargarseSolo(fila({ fechaEnvio: new Date(DESDE - 1000) }), activa, AHORA), false);
});

test('un destacamento nuevo nunca se carga solo', () => {
  assert.equal(debeCargarseSolo(fila({ esNuevo: true }), activa, AHORA), false);
  assert.equal(debeCargarseSolo(fila({ destacamento: { id: null } }), activa, AHORA), false);
});

test('lo ya cargado o descartado no se vuelve a tocar', () => {
  assert.equal(debeCargarseSolo(fila({ estado: 'cargada' }), activa, AHORA), false);
  assert.equal(debeCargarseSolo(fila({ estado: 'descartada' }), activa, AHORA), false);
});

test('un envío reservado por otra sesión espera a que venza la reserva', () => {
  const reservado = fila({ cargaAutomatica: { reservadoHasta: AHORA + RESERVA_MS } });
  assert.equal(debeCargarseSolo(reservado, activa, AHORA), false);
  assert.equal(debeCargarseSolo(reservado, activa, AHORA + RESERVA_MS + 1), true);
});

test('tras los intentos fallidos se deja para la carga manual', () => {
  assert.equal(
    debeCargarseSolo(fila({ cargaAutomatica: { intentos: INTENTOS_MAXIMOS } }), activa, AHORA),
    false
  );
});

test('la configuración y las reservas están cerradas en las reglas de Firestore', () => {
  const reglas = leer('firestore.rules');
  assert.match(
    reglas,
    /match \/configuracion_actualizaciones_destacamentos\/\{idConfiguracion\} \{\s*allow read, write: if esAdministradorGlobal\(\)/
  );
});
