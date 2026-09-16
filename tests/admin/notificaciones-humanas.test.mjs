import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { construirTituloHtml } = await import('src/services/notification-service.js');

test('el pedido recibido se expresa como un evento y nombra al cliente después', () => {
  const titulo = construirTituloHtml({
    tipoNotificacion: 'pedido_recibido',
    actorNombre: 'Roderi Daniel Peña Rosario',
    tituloHtml: '<p><strong>Roderi Daniel Peña Rosario</strong> Se recibió el pedido .</p>',
    metadatos: {
      numeroOrden: '#ORD-1024',
      clienteNombre: 'Roderi Daniel Peña Rosario',
    },
  });

  assert.equal(
    titulo,
    '<p>Se recibió el pedido <strong>#ORD-1024</strong> de <strong>Roderi Daniel Peña Rosario</strong>.</p>'
  );
});

test('el administrador asignado es el sujeto y no figura como autor de su propia asignación', () => {
  const titulo = construirTituloHtml({
    tipoNotificacion: 'administrador_creado',
    actorNombre: 'Stalin Peralta',
    tituloHtml: '<p><strong>Stalin Peralta</strong> creó al administrador .</p>',
    metadatos: { nombreMiembro: 'Stalin Peralta' },
  });

  assert.equal(titulo, '<p><strong>Stalin Peralta</strong> fue asignado como administrador.</p>');
});

test('la factura se presenta sin anteponer el nombre del cliente', () => {
  const titulo = construirTituloHtml({
    tipoNotificacion: 'factura_generada',
    actorNombre: 'Roderi Daniel Peña Rosario',
    tituloHtml: '<p><strong>Roderi Daniel Peña Rosario</strong> Se generó la factura.</p>',
    metadatos: {
      numeroFactura: '#FAC-330',
      clienteNombre: 'Roderi Daniel Peña Rosario',
    },
  });

  assert.equal(
    titulo,
    '<p>Se generó la factura <strong>#FAC-330</strong> para <strong>Roderi Daniel Peña Rosario</strong>.</p>'
  );
});
