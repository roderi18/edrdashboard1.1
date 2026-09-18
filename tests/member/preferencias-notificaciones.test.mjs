// ----------------------------------------------------------------------
// "CUENTA → NOTIFICACIONES" LISTA LOS AVISOS DE VERDAD, Y LOS DEL ESTATUS ESTÁN.
//
// La pantalla era la de la plantilla: textos de ejemplo en inglés y un botón
// que no guardaba. Ahora sale del catálogo, agrupada por módulo, y cada
// interruptor escribe la preferencia que ya se consulta al repartir el aviso.
// Los avisos del estatus del miembro tienen que estar en el catálogo: si no,
// no salen en la pantalla y nadie los puede apagar.
// ----------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { agruparTiposPorModulo, estaActivo } = await import('src/utils/modulos-notificaciones.mjs');

const leer = (relativa) => fs.readFileSync(path.join(process.cwd(), relativa), 'utf8');

test('los grupos salen en el orden de la pantalla y un módulo desconocido no se pierde', () => {
  const grupos = agruparTiposPorModulo([
    { tipoNotificacion: 'pedido_creado', modulo: 'pedidos', titulo: 'Pedido creado' },
    { tipoNotificacion: 'estatus_miembro_cambiado', modulo: 'miembros', titulo: 'Estatus' },
    { tipoNotificacion: 'x', modulo: 'nuevo_modulo', titulo: 'Algo nuevo' },
  ]);

  assert.deepEqual(
    grupos.map((grupo) => grupo.modulo),
    ['miembros', 'pedidos', 'nuevo_modulo']
  );
  assert.equal(grupos[0].titulo, 'Miembros');
  assert.equal(grupos[2].titulo, 'nuevo_modulo');
});

test('un aviso sin preferencia guardada está encendido', () => {
  assert.equal(estaActivo({}, 'mensaje_recibido'), true);
  assert.equal(
    estaActivo({ tiposNotificacion: { mensaje_recibido: false } }, 'mensaje_recibido'),
    false
  );
  assert.equal(
    estaActivo({ tiposNotificacion: { mensaje_recibido: true } }, 'mensaje_recibido'),
    true
  );
});

test('los avisos del estatus del miembro están en el catálogo y en las dos listas', () => {
  const catalogo = leer('src/utils/firebase-notificaciones.js');

  ['estatus_miembro_cambiado', 'estatus_miembro_por_caer'].forEach((tipo) => {
    assert.match(catalogo, new RegExp(`\\n  ${tipo}: \\{`), `${tipo} sin definición`);
    // Una vez en la lista de administradores y otra en la de usuarios.
    assert.equal(catalogo.split(`'${tipo}'`).length - 1, 2, `${tipo} no está en las dos listas`);
  });
});

test('la pantalla de la cuenta ya no es la de la plantilla', () => {
  const pantalla = leer('src/sections/account/account-notifications.jsx');

  assert.doesNotMatch(pantalla, /Email me when/);
  assert.match(pantalla, /guardarPreferenciaDestinatarioNotificacion/);
});
