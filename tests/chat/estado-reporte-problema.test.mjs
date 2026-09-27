import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

// EL REPORTE DE PROBLEMA LLEVA ESTADO: Abierto → En progreso → Resuelto.
//
// Lo cambian los Administradores Globales desde la tarjeta del chat y el
// servidor lo escribe en el mensaje. Si el modelo del mensaje descartara el
// estado al normalizarlo, la tarjeta volvería a salir en rojo para todos.

const { normalizarEstadoReporte, etiquetaEstadoReporte, esEstadoDeReporte } = await import(
  '../../src/utils/estado-reporte-problema.mjs'
);
const { chatMessageToUi: toPublicChatMessage } = await import('../../src/server/chat-message-model.mjs');

test('sin estado es Abierto y solo valen los tres estados', () => {
  assert.equal(normalizarEstadoReporte(undefined), 'abierto');
  assert.equal(normalizarEstadoReporte('cualquier cosa'), 'abierto');
  assert.equal(etiquetaEstadoReporte('en_progreso'), 'En progreso');
  assert.equal(etiquetaEstadoReporte('resuelto'), 'Resuelto');
  assert.equal(esEstadoDeReporte('borrado'), false);
});

test('el mensaje conserva el estado del reporte', () => {
  const mensaje = toPublicChatMessage({
    idMensaje: 'reporte_x',
    texto: 'Reporte',
    remitenteIdMiembros: 20003,
    enviadoEn: '2026-09-27T10:00:00.000Z',
    metadatos: {
      reporteProblema: {
        id: 'x',
        miembroId: 326,
        nombre: 'Persona',
        fecha: '2026-09-27T10:00:00.000Z',
        mensaje: 'No carga',
        estado: 'resuelto',
        estadoPorNombre: 'Admin',
        estadoEn: '2026-09-27T11:00:00.000Z',
      },
    },
  });
  assert.equal(mensaje.metadata.reporteProblema.estado, 'resuelto');
  assert.equal(mensaje.metadata.reporteProblema.estadoPorNombre, 'Admin');
});
