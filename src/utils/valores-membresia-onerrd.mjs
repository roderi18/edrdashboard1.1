import dayjs from 'dayjs';

import {
  LINEA_FACTURA_INICIAL,
  textoEnvioFacturaOnerrd,
  facturaDesdeValoresOnerrd,
} from 'src/utils/factura-onerrd.mjs';
import {
  regionOnerrd,
  REGIONES_ONERRD,
  crearClaveOnerrd,
  anioDeRegistroPropuesto,
} from 'src/utils/certificado-onerrd.mjs';

// ----------------------------------------------------------------------
// Los datos de "Datos del registro" de una membresía de la landing: el
// destacamento (con lo que corrigió quien pagó), las líneas de la factura y el
// pie con desde dónde y a quién se envía. Lo usan "Ver y editar", la emisión
// al confirmar un pago a mano (navegador) y la emisión automática de un pago
// con PayPal (servidor): una sola pieza para que los tres emitan lo mismo.
// ----------------------------------------------------------------------

const sinTildeOnerrd = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function valoresDeMembresia(m, remitente = '') {
  const d = {
    ...(m.destacamento || {}),
    ...Object.fromEntries(
      Object.entries(m.correcciones || {}).map(([campo, c]) => [campo, c.despues])
    ),
  };
  const region = REGIONES_ONERRD.find((r) =>
    sinTildeOnerrd(d.region).includes(sinTildeOnerrd(r.nombre).replace('region ', ''))
  );
  const plan = m.plan || {};
  // La membresía corre desde el momento en que se colocó el pago, un año: la
  // fecha del registro es esa, y la factura vence el mismo día del año siguiente.
  const colocada = m.creadoEn ? dayjs(m.creadoEn) : null;
  const fechas = colocada?.isValid()
    ? {
        fecha: colocada.hour(12).minute(0).second(0).millisecond(0).toISOString(),
        facturaVence: colocada
          .add(1, 'year')
          .hour(12)
          .minute(0)
          .second(0)
          .millisecond(0)
          .toISOString(),
      }
    : {};
  // Con la vigencia guardada en la membresía (la del panel: hoy + 1 año o un
  // rango fijo), la factura vence cuando vence la membresía.
  const [dia, mes, anio] = String(m.vigencia?.hasta || '').split('/').map(Number);
  if (dia && mes && anio) {
    fechas.facturaVence = dayjs(new Date(anio, mes - 1, dia, 12)).toISOString();
  }
  return {
    ...fechas,
    numeroDestacamento: d.numero || '',
    nombreDestacamento: d.nombre || '',
    iglesia: d.iglesia || '',
    pastor: d.pastor || '',
    coordinador: d.coordinador || '',
    registradoPor: m.registradoPor?.nombre || '',
    facturaA: m.registradoPor?.nombre || '',
    region: region?.id || '',
    facturaEstado: ['confirmada', 'pendiente_revision'].includes(m.estado) ? 'pagada' : 'pendiente',
    facturaLineas: [
      {
        descripcion: 'Cuota de registro',
        cantidad: '1',
        precio: String(plan.cuotaRegistro ?? m.montoRd ?? ''),
      },
      ...(plan.rriTrac
        ? [{ descripcion: 'RRI TRaC', cantidad: '1', precio: String(plan.rriTrac) }]
        : []),
    ],
    facturaDescuento: plan.descuento ? String(plan.descuento) : '',
    facturaCodigo: plan.descuento ? 'Fidelidad' : '',
    ...textoEnvioFacturaOnerrd({ desde: remitente, para: m.contacto?.email || '' }),
  };
}

// Lo que emite la pantalla de la pestaña ONERRD al confirmar un pago, calculado
// con los mismos datos de la membresía (`valoresDeMembresia`).
export const armarEmision = ({ membresia, config, diseno, firmas, disenoFacturaHoy }) => {
  // «Hoy» en Santo Domingo (UTC-4): decide el año del registro.
  const hoy = new Date(Date.now() - 4 * 3600_000);
  const valores = {
    anio: anioDeRegistroPropuesto(hoy),
    facturaEstado: 'pagada',
    facturaLineas: [{ ...LINEA_FACTURA_INICIAL }],
    ...valoresDeMembresia(
      // En el servidor `creadoEn` es un Timestamp; la utilidad espera una fecha.
      {
        ...membresia,
        creadoEn: membresia.creadoEn?.toDate?.().toISOString() ?? membresia.creadoEn,
      },
      config.correoRemitente
    ),
  };
  const camposDeTexto = diseno.campos.filter((campo) => campo.tipo === 'texto');
  const datos = Object.fromEntries([
    ['fecha', valores.fecha],
    ['anio', String(valores.anio)],
    ['region', regionOnerrd(valores.region) ? valores.region : ''],
    ...camposDeTexto.map((c) => [c.id, String(valores[c.id] ?? '').trim()]),
    ['facturaEnvio', String(valores.facturaEnvio || '')],
    ['facturaEnvioDetalle', String(valores.facturaEnvioDetalle || '')],
  ]);
  return {
    anio: Number(valores.anio),
    valores: datos,
    firmas: diseno.firmas.map((r) => ({
      id: r.id,
      idFirma: r.idFirma,
      nombre: firmas.find((f) => f.id === r.idFirma)?.nombre || '',
    })),
    diseno,
    claveAcceso: crearClaveOnerrd(),
    factura: facturaDesdeValoresOnerrd(valores),
    disenoFactura: disenoFacturaHoy,
  };
};
