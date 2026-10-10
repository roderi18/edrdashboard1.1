import { doc, getDoc } from 'firebase/firestore';

import { conCache, conInvalidacion } from 'src/utils/cache-de-lecturas.mjs';
import {
  tasaConMargen,
  hoyEnSantoDomingo,
  COLECCION_MEMBRESIA,
  DOC_CONFIGURACION_MEMBRESIA,
  sanearConfiguracionMembresia,
} from 'src/utils/membresia-onerrd.mjs';

import { AUTH, FIRESTORE, isFirebaseConfigured } from 'src/lib/firebase';
import { escribirConfiguracionMembresia } from 'src/services/certificado-onerrd-apply';
import { AMBITOS_CAMBIO, proponerCambio } from 'src/services/solicitudes-cambio-service';

// ----------------------------------------------------------------------
// LA CONFIGURACIÓN DE LA MEMBRESÍA ONERRD 2027 (pestaña ONERRD →
// "Membresía 2027 · landing"). Lo que se guarda aquí lo lee la landing de pago
// al momento: tarifas, planes, licencias, banco, PayPal y tasa del dólar.
//
// Toda escritura pasa por `proponerCambio` (ámbito `certificado_onerrd`): se
// aplica en el acto y queda en Historial. La clave secreta de PayPal no pasa
// por Firestore desde el navegador: la guarda el servidor.
// ----------------------------------------------------------------------

const PREFIJO = 'membresia-onerrd:';

const ENTIDAD = {
  tipo: 'certificado_onerrd',
  id: 'membresia-2027',
  nombre: 'Membresía ONERRD 2027',
  ruta: '/dashboard/certificates?tab=onerrd',
};

const asegurarFirebase = () => {
  if (!isFirebaseConfigured || !FIRESTORE) throw new Error('Firebase no está configurado.');
};

const referencia = () => doc(FIRESTORE, COLECCION_MEMBRESIA, DOC_CONFIGURACION_MEMBRESIA);

export const leerConfiguracionMembresia = conCache(`${PREFIJO}general`, async () => {
  asegurarFirebase();
  const instantanea = await getDoc(referencia());
  return sanearConfiguracionMembresia(instantanea.exists() ? instantanea.data() : {});
});

const autorDe = (user) => ({
  uid: user?.uid || user?.id || '',
  nombre: user?.displayName || user?.nombre || user?.email || '',
});

// Qué cambió, campo por campo, para Historial (sin datos de la cuenta enteros).
const ETIQUETAS = {
  cobrosAbiertos: 'Cobros abiertos',
  'cierre.fecha': 'Cierre de inscripciones',
  'cierre.mostrar': 'Mostrar la cuenta atrás',
  'cierre.texto': 'Texto de la cuenta atrás',
  'cierre.cerrarAlTerminar': 'Cerrar inscripciones al terminar',
  cuotaRegistro: 'Cuota de registro',
  precioRriTrac: 'RRI TRaC',
  descuentoFidelidad: 'Descuento por fidelidad',
  licencias: 'Destacamentos con licencia',
  correoAvisos: 'Correo de avisos',
  correoRemitente: 'Correo remitente',
  'tasa.rdPorUsd': 'Tasa del dólar',
  'tasa.diasVigencia': 'Días de vigencia de la tasa',
  'tasa.automatica': 'Tasa automática',
  'tasa.margen': 'Margen de la tasa (%)',
  'paypal.activo': 'PayPal activo',
  'paypal.correo': 'Correo de PayPal',
  'paypal.clientId': 'PayPal Client ID',
  'paypal.modo': 'Modo de PayPal',
  'vigencia.desde': 'Vigencia desde',
  'vigencia.hasta': 'Vigencia hasta',
  'vigencia.automatica': 'Vigencia: fecha actual + 1 año',
};

const valorEn = (objeto, ruta) => ruta.split('.').reduce((v, k) => v?.[k], objeto);
const comoTexto = (v) =>
  Array.isArray(v) ? v.join(', ') : v === null || v === undefined ? '' : String(v);

const cambiosEntre = (antes, despues) => {
  const lista = Object.entries(ETIQUETAS)
    .map(([campo, etiqueta]) => ({
      campo,
      etiqueta,
      antes: comoTexto(valorEn(antes, campo)),
      despues: comoTexto(valorEn(despues, campo)),
    }))
    .filter((c) => c.antes !== c.despues);
  const cuentas = (c) =>
    c.cuentas.map((x) =>
      [x.banco, x.tipoCuenta, x.numeroCuenta, x.titular, x.documento].join(' · ')
    );
  if (JSON.stringify(cuentas(antes)) !== JSON.stringify(cuentas(despues))) {
    lista.push({
      campo: 'cuentas',
      etiqueta: 'Cuentas bancarias',
      antes: cuentas(antes).join(' | '),
      despues: cuentas(despues).join(' | '),
    });
  }
  ['nuevo', 'fidelidad', 'solo_registro'].forEach((id) => {
    const a = JSON.stringify(antes.planes[id]);
    const d = JSON.stringify(despues.planes[id]);
    if (a !== d) {
      lista.push({
        campo: `planes.${id}`,
        etiqueta: `Plan ${despues.planes[id].nombre}`,
        antes: a,
        despues: d,
      });
    }
  });
  return lista;
};

export const guardarConfiguracionMembresia = conInvalidacion(
  async ({ configuracion, anterior, user }) => {
    asegurarFirebase();
    const limpia = sanearConfiguracionMembresia(configuracion);
    // La de Firestore de ahora, no la que cargó el panel: la tarea pudo
    // escribir una tasa nueva mientras el panel estaba abierto.
    const enFirestore = await getDoc(referencia()).catch(() => null);
    const guardada = sanearConfiguracionMembresia(
      enFirestore?.exists() ? enFirestore.data() : anterior
    );
    const previa = guardada.tasa;
    // La lista de inscritos 2026 tiene su propio botón y su propio guardado:
    // el panel no la pisa con la que tenía cargada.
    limpia.inscritos2026 = guardada.inscritos2026;
    if (limpia.tasa.automatica) {
      // En automática la tasa la escribe la tarea de las 6:00 a. m.: guardar
      // el panel no la pisa con la que tenía el formulario. Si cambia el
      // margen, se recalcula sobre la última lectura.
      const { automatica, margen, diasVigencia } = limpia.tasa;
      limpia.tasa = { ...previa, automatica, margen, diasVigencia };
      if (previa.base && (margen !== previa.margen || !previa.automatica)) {
        limpia.tasa.rdPorUsd = tasaConMargen(previa.base, margen);
      }
    } else if (limpia.tasa.rdPorUsd !== previa.rdPorUsd || !limpia.tasa.fecha) {
      // A mano, la tasa lleva la fecha del día en que se escribe: de ahí
      // cuenta su vigencia.
      limpia.tasa.fecha = limpia.tasa.rdPorUsd ? hoyEnSantoDomingo() : '';
      // Y la hora exacta en que se escribió (el panel la enseña).
      limpia.tasa.leidaEn = limpia.tasa.rdPorUsd ? new Date().toISOString() : '';
    }
    const cambios = cambiosEntre(sanearConfiguracionMembresia(anterior), limpia);
    await proponerCambio({
      ambito: AMBITOS_CAMBIO.certificadoOnerrd,
      entidad: ENTIDAD,
      cambios,
      usuario: user,
      descripcion: 'Configuración de la membresía ONERRD 2027 (landing de pago).',
      aplicarDirecto: true,
      lecturasAfectadas: [PREFIJO],
      aplicar: () => escribirConfiguracionMembresia(limpia, autorDe(user)),
    });
    return limpia;
  },
  [PREFIJO]
);

// ---------------------------------------------------------------------- clave de PayPal

const conToken = async () => {
  const token = await AUTH?.currentUser?.getIdToken();
  if (!token) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  return { Authorization: `Bearer ${token}` };
};

const RUTA_SECRETOS = '/api/certificados-onerrd/membresia/secretos';

export const leerEstadoSecretosMembresia = async () => {
  const r = await fetch(RUTA_SECRETOS, { headers: await conToken(), cache: 'no-store' });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error(datos.error || datos.Message || 'No se pudo leer la configuración de PayPal.');
  return datos;
};

// `claveSecreta` vacía no cambia la guardada; `borrarClave` la quita.
export const guardarSecretosMembresia = async ({ claveSecreta, webhookId, borrarClave, user }) => {
  const cambios = [];
  if (claveSecreta)
    cambios.push({
      campo: 'paypal.claveSecreta',
      etiqueta: 'Clave secreta de PayPal',
      antes: '',
      despues: '(nueva, oculta)',
    });
  if (borrarClave)
    cambios.push({
      campo: 'paypal.claveSecreta',
      etiqueta: 'Clave secreta de PayPal',
      antes: '(oculta)',
      despues: '',
    });
  if (typeof webhookId === 'string')
    cambios.push({
      campo: 'paypal.webhookId',
      etiqueta: 'Webhook ID de PayPal',
      antes: '',
      despues: webhookId,
    });
  await proponerCambio({
    ambito: AMBITOS_CAMBIO.certificadoOnerrd,
    entidad: ENTIDAD,
    cambios,
    usuario: user,
    descripcion: 'Credenciales de PayPal de la membresía ONERRD 2027.',
    aplicarDirecto: true,
    aplicar: async () => {
      const r = await fetch(RUTA_SECRETOS, {
        // eslint-disable-next-line no-restricted-syntax
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await conToken()) },
        body: JSON.stringify({ claveSecreta, webhookId, borrarClave }),
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok)
        throw new Error(datos.error || datos.Message || 'No se pudo guardar la clave de PayPal.');
    },
  });
};

// ---------------------------------------------------------------------- pagos

const RUTA_PAGOS = '/api/certificados-onerrd/membresia/pagos';

// Las membresías de la landing y el padrón activo. Se guarda un momento para
// que abrir y cerrar el desplegable no vuelva a pedirlas.
export const leerPagosMembresia = conCache(`${PREFIJO}pagos`, async () => {
  const r = await fetch(RUTA_PAGOS, { headers: await conToken(), cache: 'no-store' });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error || datos.Message || 'No se pudieron leer los pagos.');
  return datos;
});

// El comprobante de una transferencia, como archivo para la ventana flotante.
export const leerComprobanteMembresia = async (id) => {
  const r = await fetch(
    `/api/certificados-onerrd/membresia/comprobante?id=${encodeURIComponent(id)}`,
    {
      headers: await conToken(),
      cache: 'no-store',
    }
  );
  if (!r.ok) {
    const datos = await r.json().catch(() => ({}));
    throw new Error(datos.error || datos.Message || 'No se pudo abrir el comprobante.');
  }
  return r.blob();
};

// Anota en la membresía el certificado que se le emitió (queda en Historial).
export const anotarCertificadoEnMembresia = conInvalidacion(
  async ({ id, numeroRegistro, facturaNumero, destacamento, user }) => {
    await proponerCambio({
      ambito: AMBITOS_CAMBIO.certificadoOnerrd,
      entidad: ENTIDAD,
      cambios: [
        {
          campo: `membresia.${id}.certificado`,
          etiqueta: `Certificado de ${destacamento || `destacamento ${id}`}`,
          antes: '',
          despues: [numeroRegistro, facturaNumero].filter(Boolean).join(' · '),
        },
      ],
      usuario: user,
      descripcion: `Certificado ${numeroRegistro} emitido para la membresía 2027.`,
      aplicarDirecto: true,
      aplicar: async () => {
        const r = await fetch(RUTA_PAGOS, {
          // eslint-disable-next-line no-restricted-syntax
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await conToken()) },
          body: JSON.stringify({ id, numeroRegistro, facturaNumero }),
        });
        if (!r.ok) {
          const datos = await r.json().catch(() => ({}));
          throw new Error(datos.error || datos.Message || 'No se pudo anotar el certificado.');
        }
      },
    });
  },
  [`${PREFIJO}pagos`]
);

// "Actualizar ahora" de la tasa automática: lo mismo que la tarea diaria. No
// es un cambio de nadie (la tasa la escribe "Sistema", igual que a las 6:00),
// así que no pasa por Historial.
export const actualizarTasaAhora = conInvalidacion(async () => {
  const r = await fetch('/api/certificados-onerrd/membresia/tasa', {
    // eslint-disable-next-line no-restricted-syntax
    method: 'POST',
    headers: await conToken(),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error || 'No se pudo leer la tasa.');
  return datos;
}, [PREFIJO]);

// El estado de una membresía (confirmar, rechazar o devolver a revisión). Pasa
// por Historial; el servidor comprueba que el cambio siga siendo posible.
const ETIQUETAS_ESTADO = {
  confirmar: 'Confirmada (pagada)',
  rechazar: 'Rechazada',
  revision: 'De vuelta a revisión',
};

export const cambiarEstadoMembresia = conInvalidacion(
  async ({ id, accion, motivo = '', estadoAntes, destacamento, user }) => {
    let resultado = null;
    await proponerCambio({
      ambito: AMBITOS_CAMBIO.certificadoOnerrd,
      entidad: ENTIDAD,
      cambios: [
        {
          campo: `membresia.${id}.estado`,
          etiqueta: `Estado de la membresía de ${destacamento || `destacamento ${id}`}`,
          antes: estadoAntes || '',
          despues: [ETIQUETAS_ESTADO[accion], motivo && `motivo: ${motivo}`]
            .filter(Boolean)
            .join(' · '),
        },
      ],
      usuario: user,
      descripcion: `Membresía 2027: ${ETIQUETAS_ESTADO[accion]?.toLowerCase()}.`,
      aplicarDirecto: true,
      aplicar: async () => {
        const r = await fetch('/api/certificados-onerrd/membresia/estado', {
          // eslint-disable-next-line no-restricted-syntax
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await conToken()) },
          body: JSON.stringify({ id, accion, motivo }),
        });
        const datos = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(datos.error || 'No se pudo cambiar el estado.');
        resultado = datos;
      },
    });
    return resultado;
  },
  [`${PREFIJO}pagos`]
);

// Envía por correo el certificado y la factura recién emitidos (PDF) a quien
// pagó. Devuelve { registro, membresia }: el registro dice si salió.
export const enviarDocumentosMembresia = conInvalidacion(
  async ({ id, numeroRegistro, facturaNumero, certificado, factura }) => {
    const datos = new FormData();
    datos.set('id', id);
    datos.set('numeroRegistro', numeroRegistro || '');
    datos.set('facturaNumero', facturaNumero || '');
    if (certificado) datos.set('certificado', certificado, 'certificado.pdf');
    if (factura) datos.set('factura', factura, 'factura.pdf');
    const r = await fetch('/api/certificados-onerrd/membresia/enviar', {
      // eslint-disable-next-line no-restricted-syntax
      method: 'POST',
      headers: await conToken(),
      body: datos,
    });
    const respuesta = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(respuesta.error || 'No se pudo enviar el correo.');
    return respuesta;
  },
  [`${PREFIJO}pagos`]
);

// ---------------------------------------------------------------------- inscritos 2026

// La lista de destacamentos inscritos en 2026 (el reporte de registro anual de
// 2026): a ellos les toca el plan «Registrado en 2026». Solo cambia esa parte
// de la configuración; queda en Historial cuántas filas tenía y cuántas tiene.
export const guardarInscritos2026 = conInvalidacion(
  async ({ filas, user }) => {
    asegurarFirebase();
    const instantanea = await getDoc(referencia());
    const actual = sanearConfiguracionMembresia(instantanea.exists() ? instantanea.data() : {});
    const nueva = sanearConfiguracionMembresia({ ...actual, inscritos2026: filas });
    await proponerCambio({
      ambito: AMBITOS_CAMBIO.certificadoOnerrd,
      entidad: ENTIDAD,
      cambios: [
        {
          campo: 'inscritos2026',
          etiqueta: 'Destacamentos inscritos en 2026',
          antes: `${actual.inscritos2026.length} destacamentos`,
          despues: `${nueva.inscritos2026.length} destacamentos`,
        },
      ],
      usuario: user,
      descripcion: 'Lista de destacamentos inscritos en 2026 (descuento por fidelidad).',
      aplicarDirecto: true,
      lecturasAfectadas: [PREFIJO],
      aplicar: () => escribirConfiguracionMembresia(nueva, autorDe(user)),
    });
    return nueva.inscritos2026;
  },
  [PREFIJO]
);
