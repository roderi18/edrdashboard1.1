// ----------------------------------------------------------------------
// UN PAGO CON PAYPAL NO ESPERA A LA OFICINA NACIONAL: el certificado y la
// factura los emite el servidor al confirmarse el pago.
//
// Qué se rompía: el certificado y la factura se generaban SOLO en el navegador
// de quien tenía la pestaña ONERRD abierta. Un pago con PayPal queda confirmado
// al instante y sin nadie delante, así que se quedaba sin documentos hasta que
// alguien los emitiera a mano. Ahora los emite una ruta del servidor con las
// mismas reglas que la pantalla (`armarEmision`); estas pruebas guardan:
//   · lo que se emite sale de la misma pieza que usa la pantalla;
//   · la ruta solo responde con el secreto del servidor;
//   · la emisión es idempotente y no se pisa con otra en marcha;
//   · una transferencia sigue esperando la validación (la emite quien confirma).
// ----------------------------------------------------------------------

import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';

register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { armarEmision, valoresDeMembresia } = await import(
  '../../src/utils/valores-membresia-onerrd.mjs'
);
const { sanearDisenoOnerrd } = await import('../../src/utils/certificado-onerrd.mjs');
const { sanearDisenoFacturaOnerrd, datosDeFacturaOnerrd } = await import(
  '../../src/utils/factura-onerrd.mjs'
);
const { sanearConfiguracionMembresia } = await import('../../src/utils/membresia-onerrd.mjs');

const leer = (ruta) => readFile(new URL(`../../${ruta}`, import.meta.url), 'utf8');

const membresia = {
  estado: 'confirmada',
  tipoPago: 'paypal',
  // En el servidor, un Timestamp de Firestore y no una fecha en texto.
  creadoEn: { toDate: () => new Date('2026-10-09T15:30:00Z') },
  destacamento: {
    numero: '18',
    nombre: 'Tribu de Judá',
    region: 'Región Central',
    iglesia: 'Iglesia Aposento Alto, A.D.',
    pastor: 'Pastor Ejemplo',
    coordinador: 'Coordinador Ejemplo',
  },
  registradoPor: { nombre: 'Persona Ejemplo' },
  contacto: { email: 'persona@example.com' },
  plan: { cuotaRegistro: 1500, rriTrac: 1000, descuento: 250 },
  montoRd: 2250,
};

const preparar = (m = membresia) =>
  armarEmision({
    membresia: m,
    config: sanearConfiguracionMembresia({ correoRemitente: 'oficina@errd.org.do' }),
    diseno: sanearDisenoOnerrd(),
    firmas: [],
    disenoFacturaHoy: sanearDisenoFacturaOnerrd(),
  });

test('el certificado sale con los datos del destacamento y la región de la membresía', () => {
  const e = preparar();
  assert.equal(e.valores.numeroDestacamento, '18');
  assert.equal(e.valores.nombreDestacamento, 'Tribu de Judá');
  assert.equal(e.valores.region, 'central');
  assert.equal(e.valores.pastor, 'Pastor Ejemplo');
  assert.match(e.claveAcceso, /^[A-Za-z0-9_-]{10,}$/);
});

test('la factura sale pagada, con sus líneas y descuento, a nombre de quien registró', () => {
  const e = preparar();
  assert.equal(e.factura.estado, 'pagada');
  assert.equal(e.factura.facturarA, 'Persona Ejemplo');
  assert.deepEqual(
    e.factura.lineas.map((l) => [l.descripcion, l.precio]),
    [
      ['Cuota de registro', 1500],
      ['RRI TRaC', 1000],
    ]
  );
  const datos = datosDeFacturaOnerrd({
    anio: e.anio,
    valores: e.valores,
    numeroRegistro: '2027-001',
    emitidoEnIso: '2026-10-09T15:30:00.000Z',
    factura: { ...e.factura, numero: 'ONERRD-2026-001' },
  });
  assert.equal(datos.total, '2,250.00');
  assert.equal(datos.sello, 'PAGADO');
});

test('la fecha del registro es la del pago aunque llegue como Timestamp del servidor', () => {
  const desdeTimestamp = valoresDeMembresia({
    ...membresia,
    creadoEn: membresia.creadoEn.toDate().toISOString(),
  });
  const e = preparar();
  // El mismo día y un año de vigencia: lo que ya hacía la pantalla.
  assert.equal(e.valores.fecha, desdeTimestamp.fecha);
  assert.ok(e.valores.fecha);
  assert.equal(e.factura.vence, desdeTimestamp.facturaVence);
});

test('la ruta de emisión solo responde con el secreto del servidor', async () => {
  const ruta = await leer('src/app/api/certificados-onerrd/membresia/emitir-automatico/route.js');
  assert.match(ruta, /secretoDeTareaValido\(recibido, process\.env\.TAREAS_PROGRAMADAS_SECRETO\)/);
  assert.match(ruta, /return new Response\('No autorizado\.', \{ status: 401 \}\)/);
  // Sin secreto no se llega a leer nada de Firestore.
  assert.ok(ruta.indexOf('No autorizado') < ruta.indexOf('emitirDocumentosDeMembresia(id'));
});

test('emitir es idempotente: ya emitida no repite y una en marcha no se pisa', async () => {
  const codigo = await leer('src/server/emision-membresia-onerrd.js');
  assert.match(codigo, /if \(m\.certificadoEmitido\?\.numeroRegistro\)\s+return \{ estado: 'listo'/);
  assert.match(codigo, /marca\?\.estado === 'generando'/);
  // Solo una membresía pagada se emite.
  assert.match(codigo, /m\.estado !== 'confirmada'/);
  // El número reservado de un intento cortado se reutiliza en vez de gastar otro.
  assert.match(codigo, /numeroPrevio/);
});

test('la landing solo pide la emisión de un pago con PayPal confirmado', async () => {
  const ruta = await readFile(
    new URL(
      '../../../onerrd-membresia/src/app/api/solicitudes/[token]/documentos/route.js',
      import.meta.url
    ),
    'utf8'
  ).catch(() => null);
  if (ruta === null) return; // otro repositorio: no siempre está al lado
  assert.match(ruta, /membresia\.tipoPago !== 'paypal'/);
  assert.match(ruta, /membresia\.estado !== 'confirmada'/);
});

test('las fuentes del PDF se registran desde el disco en el servidor', async () => {
  const pdf = await leer('src/sections/certificates/onerrd/onerrd-pdf.jsx');
  assert.match(pdf, /typeof window === 'undefined' \? `\$\{process\.cwd\(\)\}\/public\/fuentes`/);
});
