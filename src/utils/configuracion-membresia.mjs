// ----------------------------------------------------------------------
// LA CONFIGURACIÓN DE LA MEMBRESÍA ONERRD 2027: lo que la Oficina Nacional
// cambia desde la pestaña ONERRD ("Membresía 2027 · landing") y lo que la
// landing de pago (proyecto aparte, `onerrd-membresia`) lee al momento.
//
// Vive en Firestore, `configuracionMembresia2027/general`. La clave secreta de
// PayPal NO va aquí: va a `configuracionMembresia2027/secretos`, que solo
// escribe y lee el servidor (Admin SDK); el navegador solo sabe si está puesta.
//
// Este archivo tiene una COPIA EXACTA en la landing
// (`onerrd-membresia/src/utils/configuracion-membresia.mjs`): si cambia uno,
// cambia el otro. Los dos repositorios no comparten paquetes.
//
// Los precios no se escriben plan por plan: se escriben las piezas (cuota de
// registro, RRI TRaC, descuento por fidelidad) y cada plan las suma. Así el
// desglose de la factura siempre cuadra con el total.
// ----------------------------------------------------------------------

export const COLECCION_MEMBRESIA = 'configuracionMembresia2027';
export const DOC_CONFIGURACION_MEMBRESIA = 'general';
export const DOC_SECRETOS_MEMBRESIA = 'secretos';

export const ANIO_MEMBRESIA = 2027;

export const IDS_DE_PLANES = Object.freeze(['nuevo', 'fidelidad', 'solo_registro']);

// Lo que no se edita de cada plan: su color e icono, y qué piezas suma.
const FORMA_DE_PLANES = Object.freeze({
  nuevo: {
    color: 'error',
    icono: 'solar:users-group-rounded-bold',
    rriTrac: true,
    descuento: false,
  },
  fidelidad: { color: 'primary', icono: 'solar:medal-star-bold', rriTrac: true, descuento: true },
  solo_registro: {
    color: 'success',
    icono: 'solar:monitor-bold',
    rriTrac: false,
    descuento: false,
  },
});

export const CONFIGURACION_MEMBRESIA_DE_FABRICA = Object.freeze({
  // Mientras sea false, la landing se ve entera pero no cobra.
  cobrosAbiertos: false,
  vigencia: Object.freeze({ desde: '01/01/2027', hasta: '31/12/2027' }),
  cuotaRegistro: 1500,
  precioRriTrac: 1000,
  descuentoFidelidad: 250,
  planes: Object.freeze({
    nuevo: Object.freeze({
      activo: true,
      nombre: 'No registrado en 2026',
      detalle: 'RRI TRaC incluido',
      etiqueta: 'Única opción sin registro 2026',
    }),
    fidelidad: Object.freeze({
      activo: true,
      nombre: 'Registrado en 2026',
      detalle: 'RRI TRaC incluido',
      etiqueta: 'Descuento por fidelidad',
    }),
    solo_registro: Object.freeze({
      activo: true,
      nombre: 'Licencia RRI TRaC activa',
      detalle: 'Solo cuota de registro',
      etiqueta: 'Ya tienes la licencia',
    }),
  }),
  // Números de los destacamentos con licencia RRI TRaC que habilita el plan
  // "solo cuota de registro".
  licencias: Object.freeze([]),
  // Cuentas para la transferencia (la landing las enseña todas). Antes había
  // una sola, `banco`, con `rnc`: se sigue leyendo como la primera cuenta.
  cuentas: Object.freeze([]),
  paypal: Object.freeze({ activo: false, correo: '', clientId: '', modo: 'sandbox' }),
  // RD$ por US$1. `fecha` (AAAA-MM-DD) la pone el guardado; pasados
  // `diasVigencia` días sin actualizarla, PayPal se apaga solo.
  // Con `automatica`, la tarea de las 6:00 a. m. la lee de internet (`base`,
  // sin margen) y cobra con `rdPorUsd` = base menos el `margen` %, que cubre la
  // conversión de PayPal. `fuente`, `leidaEn`, `fallosSeguidos` y
  // `ultimoError` dicen cómo fue la última lectura.
  tasa: Object.freeze({
    rdPorUsd: null,
    fecha: '',
    diasVigencia: 1,
    automatica: false,
    margen: 3,
    base: null,
    fuente: '',
    leidaEn: '',
    fallosSeguidos: 0,
    ultimoError: '',
  }),
  // Copia de cada confirmación y rechazo (buzón de la Oficina Nacional).
  correoAvisos: '',
  // Desde dónde salen los correos (debe ser de un dominio verificado en el
  // servicio de correo de la landing).
  correoRemitente: '',
});

// ---------------------------------------------------------------------- saneado

const texto = (valor, fabrica = '', maximo = 160) =>
  typeof valor === 'string' ? valor.trim().slice(0, maximo) : fabrica;

const monto = (valor, fabrica) => {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? Math.round(n * 100) / 100 : fabrica;
};

const correo = (valor) => {
  const v = texto(valor, '', 200).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : '';
};

const fechaIso = (valor) => (/^\d{4}-\d{2}-\d{2}$/.test(String(valor || '')) ? valor : '');

const fechaDdMmAaaa = (valor, fabrica) =>
  /^\d{2}\/\d{2}\/\d{4}$/.test(String(valor || '')) ? valor : fabrica;

// "025", "#25" y "25" son el mismo destacamento.
export const normalizarNumeroDestacamento = (valor) => {
  const digitos = String(valor ?? '')
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '');
  return digitos && digitos.length <= 6 ? digitos : '';
};

export const MAXIMO_DE_CUENTAS = 10;

const sanearCuenta = (c = {}) => ({
  banco: texto(c.banco ?? c.nombre, '', 80),
  titular: texto(c.titular, '', 120),
  tipoCuenta: texto(c.tipoCuenta, '', 40),
  numeroCuenta: texto(c.numeroCuenta, '', 40),
  documento: texto(c.documento ?? c.rnc, '', 20),
});

const cuentaConDatos = (c) => Boolean(c.banco || c.titular || c.numeroCuenta || c.documento);

function sanearCuentas(e) {
  const lista = Array.isArray(e.cuentas) ? e.cuentas : e.banco ? [e.banco] : [];
  return lista
    .filter((c) => c && typeof c === 'object')
    .map(sanearCuenta)
    .filter(cuentaConDatos)
    .slice(0, MAXIMO_DE_CUENTAS);
}

// Una cuenta sirve para transferir con banco, titular y número.
export const cuentaCompleta = (c) => Boolean(c.banco && c.titular && c.numeroCuenta);
export const cuentasListas = (config) => config.cuentas.filter(cuentaCompleta);

export const cuentaVacia = () => sanearCuenta();

export function sanearConfiguracionMembresia(entrada = {}) {
  const f = CONFIGURACION_MEMBRESIA_DE_FABRICA;
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  const planes = Object.fromEntries(
    IDS_DE_PLANES.map((id) => {
      const p = e.planes?.[id] || {};
      const fp = f.planes[id];
      return [
        id,
        {
          activo: p.activo !== false,
          nombre: texto(p.nombre, fp.nombre, 60) || fp.nombre,
          detalle: texto(p.detalle, fp.detalle, 80),
          etiqueta: texto(p.etiqueta, fp.etiqueta, 60),
        },
      ];
    })
  );
  const tasa = Number(e.tasa?.rdPorUsd);
  const dias = Number(e.tasa?.diasVigencia);
  const base = Number(e.tasa?.base);
  const margen = Number(e.tasa?.margen);
  const fallos = Number(e.tasa?.fallosSeguidos);
  return {
    cobrosAbiertos: e.cobrosAbiertos === true,
    vigencia: {
      desde: fechaDdMmAaaa(e.vigencia?.desde, f.vigencia.desde),
      hasta: fechaDdMmAaaa(e.vigencia?.hasta, f.vigencia.hasta),
    },
    cuotaRegistro: monto(e.cuotaRegistro, f.cuotaRegistro),
    precioRriTrac: monto(e.precioRriTrac, f.precioRriTrac),
    descuentoFidelidad: monto(e.descuentoFidelidad, f.descuentoFidelidad),
    planes,
    licencias: [
      ...new Set((Array.isArray(e.licencias) ? e.licencias : []).map(normalizarNumeroDestacamento)),
    ]
      .filter(Boolean)
      .slice(0, 500),
    cuentas: sanearCuentas(e),
    paypal: {
      activo: e.paypal?.activo === true,
      correo: correo(e.paypal?.correo),
      clientId: texto(e.paypal?.clientId, '', 200),
      modo: e.paypal?.modo === 'live' ? 'live' : 'sandbox',
    },
    tasa: {
      rdPorUsd:
        Number.isFinite(tasa) && tasa > 0 && tasa < 10_000
          ? Math.round(tasa * 10000) / 10000
          : null,
      fecha: fechaIso(e.tasa?.fecha),
      diasVigencia: Number.isInteger(dias) && dias >= 1 && dias <= 31 ? dias : f.tasa.diasVigencia,
      automatica: e.tasa?.automatica === true,
      margen:
        e.tasa?.margen !== undefined && Number.isFinite(margen) && margen >= 0 && margen <= 20
          ? Math.round(margen * 100) / 100
          : f.tasa.margen,
      base:
        Number.isFinite(base) && base > 0 && base < 10_000
          ? Math.round(base * 10000) / 10000
          : null,
      fuente: texto(e.tasa?.fuente, '', 80),
      leidaEn: texto(e.tasa?.leidaEn, '', 40),
      fallosSeguidos: Number.isInteger(fallos) && fallos >= 0 ? Math.min(fallos, 999) : 0,
      ultimoError: texto(e.tasa?.ultimoError, '', 200),
    },
    correoAvisos: correo(e.correoAvisos),
    correoRemitente: correo(e.correoRemitente),
  };
}

// Un descuento mayor que lo que descuenta dejaría un plan negativo.
export function problemasDeConfiguracion(config) {
  const problemas = [];
  if (config.descuentoFidelidad > config.cuotaRegistro + config.precioRriTrac) {
    problemas.push('El descuento por fidelidad no puede ser mayor que la cuota más RRI TRaC.');
  }
  if (config.cobrosAbiertos) {
    const hayBanco = cuentasListas(config).length > 0;
    const hayPaypal = config.paypal.activo;
    if (!hayBanco && !hayPaypal) {
      problemas.push('Para abrir los cobros falta la cuenta bancaria o activar PayPal.');
    }
  }
  // En automática la tasa llega sola (a las 6:00 a. m. o con "Actualizar ahora").
  const sinTasa = !config.tasa.rdPorUsd && !config.tasa.automatica;
  if (config.paypal.activo && (!config.paypal.clientId || sinTasa)) {
    problemas.push('PayPal necesita el Client ID y la tasa del dólar.');
  }
  if (!IDS_DE_PLANES.some((id) => config.planes[id].activo)) {
    problemas.push('Debe quedar al menos un plan activo.');
  }
  return problemas;
}

// ---------------------------------------------------------------------- planes

// Los tres planes, con sus precios ya sumados.
export function construirPlanes(config) {
  return Object.fromEntries(
    IDS_DE_PLANES.map((id) => {
      const forma = FORMA_DE_PLANES[id];
      const textos = config.planes[id];
      const rriTrac = forma.rriTrac ? config.precioRriTrac : 0;
      const descuento = forma.descuento ? config.descuentoFidelidad : 0;
      return [
        id,
        {
          id,
          ...textos,
          color: forma.color,
          icono: forma.icono,
          incluyeRriTrac: forma.rriTrac,
          cuotaRegistro: config.cuotaRegistro,
          rriTrac,
          descuento,
          precio: Math.max(0, config.cuotaRegistro + rriTrac - descuento),
        },
      ];
    })
  );
}

// Qué planes le tocan a un destacamento. Con el registro 2026 desconocido
// (null) no se supone ni el descuento ni la tarifa completa; con licencia,
// además la cuota sola. Un plan apagado no se ofrece.
export function planesDisponibles({ registrado2026, licenciaVigente }, config) {
  const planes = construirPlanes(config);
  const base =
    registrado2026 === true ? planes.fidelidad : registrado2026 === false ? planes.nuevo : null;
  return [licenciaVigente === true ? planes.solo_registro : null, base].filter(
    (plan) => plan && plan.activo
  );
}

export const tieneLicencia = (config, numeroDestacamento) =>
  config.licencias.includes(normalizarNumeroDestacamento(numeroDestacamento));

// ---------------------------------------------------------------------- bancos

// Los bancos y asociaciones de la República Dominicana, con su dominio: el
// logo es el ícono de su web (`logoDeBanco`). Si no carga, se pinta la inicial.
export const BANCOS_RD = Object.freeze([
  { nombre: 'Banco Popular Dominicano', dominio: 'popularenlinea.com' },
  { nombre: 'Banreservas', dominio: 'banreservas.com' },
  { nombre: 'Banco BHD', dominio: 'bhd.com.do' },
  { nombre: 'Scotiabank', dominio: 'scotiabank.com.do' },
  { nombre: 'Banco Santa Cruz', dominio: 'bsc.com.do' },
  { nombre: 'Banco Promerica', dominio: 'promerica.com.do' },
  { nombre: 'Banesco', dominio: 'banesco.com.do' },
  { nombre: 'Banco Caribe', dominio: 'bancocaribe.com.do' },
  { nombre: 'Banco BDI', dominio: 'bdi.com.do' },
  { nombre: 'Banco López de Haro', dominio: 'blh.com.do' },
  { nombre: 'Banco Vimenca', dominio: 'vimenca.com' },
  { nombre: 'Banco Lafise', dominio: 'lafise.com' },
  { nombre: 'Banco Activo', dominio: 'bancoactivo.com.do' },
  { nombre: 'Banco Ademi', dominio: 'bancoademi.com.do' },
  { nombre: 'Banco Adopem', dominio: 'bancoadopem.com.do' },
  { nombre: 'Banfondesa', dominio: 'banfondesa.com.do' },
  { nombre: 'Banco Agrícola', dominio: 'bagricola.gob.do' },
  { nombre: 'Citibank', dominio: 'citi.com' },
  { nombre: 'Qik Banco Digital', dominio: 'qik.do' },
  { nombre: 'Asociación Popular de Ahorros y Préstamos (APAP)', dominio: 'apap.com.do' },
  { nombre: 'Asociación Cibao de Ahorros y Préstamos', dominio: 'cibao.com.do' },
  { nombre: 'Asociación La Nacional de Ahorros y Préstamos', dominio: 'alnap.com.do' },
]);

export const logoDeBanco = (nombre) => {
  const banco = BANCOS_RD.find((b) => b.nombre === nombre);
  return banco ? `https://www.google.com/s2/favicons?domain=${banco.dominio}&sz=64` : '';
};

// ---------------------------------------------------------------------- tasa

// La fecha de hoy en Santo Domingo, AAAA-MM-DD.
export const hoyEnSantoDomingo = (ahora = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santo_Domingo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);

// La tasa, si sigue vigente (actualizada hace menos de `diasVigencia` días).
export function tasaVigente(config, ahora = new Date()) {
  const { rdPorUsd, fecha, diasVigencia } = config.tasa;
  if (!rdPorUsd || !fecha) return null;
  const dias =
    (Date.parse(`${hoyEnSantoDomingo(ahora)}T00:00:00Z`) - Date.parse(`${fecha}T00:00:00Z`)) /
    86_400_000;
  return dias >= 0 && dias < diasVigencia ? rdPorUsd : null;
}

// ---------------------------------------------------------------------- tasa automática

// LA TASA OFICIAL: la de referencia del Banco Central (BCRD), que publica cada
// día laborable en un Excel (hoja "Diaria": año, mes, día, compra, venta). Se
// usa la de COMPRA: es a la que el banco le compra a la Oficina Nacional los
// dólares que entran por PayPal, así que cobrando con ella no se recibe menos.
// A las 6:00 a. m. aún no está la de hoy: sale la del último día laborable.
export const FUENTE_TASA_AUTOMATICA = {
  nombre: 'Banco Central de la República Dominicana (BCRD)',
  descripcion: 'tasa de referencia del mercado spot, la de compra del último día publicado',
  web: 'https://www.bancentral.gov.do',
  url: 'https://cdn.bancentral.gov.do/documents/estadisticas/mercado-cambiario/documents/TASA_DOLAR_REFERENCIA_MC.xlsx',
};

// Si el BCRD no responde (o cambia su archivo), la de mercado de
// ExchangeRate-API, para no quedarse sin tasa; la lectura dice cuál se usó.
export const FUENTE_TASA_RESPALDO = {
  nombre: 'ExchangeRate-API (respaldo)',
  url: 'https://open.er-api.com/v6/latest/USD',
};

const MESES_BCRD = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/**
 * La última tasa de las filas de la hoja "Diaria" del BCRD:
 * `{ compra, venta, fecha: 'AAAA-MM-DD' }`, o null si no hay ninguna válida.
 */
export function tasaDeFilasBcrd(filas = []) {
  for (let i = filas.length - 1; i >= 0; i -= 1) {
    const [anio, mes, dia, compra, venta] = filas[i] || [];
    const m = MESES_BCRD.indexOf(
      String(mes || '')
        .trim()
        .slice(0, 3)
        .toLowerCase()
    );
    if (Number.isInteger(anio) && m >= 0 && Number.isInteger(dia) && Number(compra) > 0) {
      const fecha = `${anio}-${String(m + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      return { compra: Number(compra), venta: Number(venta) || null, fecha };
    }
  }
  return null;
}

// Si la lectura falla, la tasa de ayer sigue cobrando hasta tres días; después
// se deja vencer (PayPal se apaga) antes que cobrar con una tasa muy vieja.
export const DIAS_CON_TASA_ANTERIOR = 3;

// Un peso dominicano fuera de esto es un error de la fuente, no la tasa real.
export const tasaRazonable = (valor) => Number.isFinite(valor) && valor > 30 && valor < 200;

// La tasa con la que se cobra: el margen la baja, y así se piden más dólares.
export const tasaConMargen = (base, margen) =>
  Math.round((base / (1 + (Number(margen) || 0) / 100)) * 10000) / 10000;

/**
 * La tasa tras una lectura automática: `{ valor }` si salió bien, `{ error }`
 * si no. Sin `automatica` no toca nada. Un fallo nunca deja la tasa vacía.
 */
export function tasaTrasLectura(tasa, lectura, ahora = new Date()) {
  if (!tasa.automatica) return tasa;
  const hoy = hoyEnSantoDomingo(ahora);
  if (lectura && tasaRazonable(lectura.valor)) {
    const base = Math.round(lectura.valor * 10000) / 10000;
    return {
      ...tasa,
      base,
      rdPorUsd: tasaConMargen(base, tasa.margen),
      fecha: hoy,
      fuente: lectura.fuente || FUENTE_TASA_AUTOMATICA.nombre,
      leidaEn: ahora.toISOString(),
      fallosSeguidos: 0,
      ultimoError: '',
    };
  }
  const fallosSeguidos = tasa.fallosSeguidos + 1;
  const sigueLaAnterior = Boolean(tasa.rdPorUsd) && fallosSeguidos <= DIAS_CON_TASA_ANTERIOR;
  return {
    ...tasa,
    fecha: sigueLaAnterior ? hoy : tasa.fecha,
    fallosSeguidos,
    ultimoError: String(lectura?.error || 'La fuente no devolvió una tasa válida.').slice(0, 200),
  };
}

// Los dólares se redondean HACIA ARRIBA al centavo: redondeando al más
// cercano, US$37.95 × 59.2821 daba RD$2,249.75 y faltaban 25 centavos del
// precio del plan. Así, dólares × tasa nunca queda por debajo.
export const centavosArriba = (montoRd, tasa) =>
  Math.ceil(Math.round((montoRd / tasa) * 100 * 1e6) / 1e6) / 100;

export const aDolares = (montoRd, tasa) =>
  Number.isFinite(tasa) && tasa > 0 ? centavosArriba(montoRd, tasa).toFixed(2) : null;

// "RD$2,250" (coma de miles, como la factura).
export const formatearRd = (valor, { decimales = false } = {}) =>
  `RD$${Number(valor || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimales ? 2 : 0,
    maximumFractionDigits: decimales ? 2 : 0,
  })}`;
