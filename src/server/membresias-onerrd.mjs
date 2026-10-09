import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import { UPSTREAM_KEYS, fetchUpstreamText } from 'src/utils/upstream-cache';

import { COLECCIONES } from 'src/config/esquema-firestore.mjs';

// ----------------------------------------------------------------------
// LAS MEMBRESÍAS 2027 QUE ENTRAN POR LA LANDING DE PAGO, para el desplegable
// "Membresías 2027 · pagos" de la pestaña ONERRD.
//
// `membresiasOnerrd2027/{idDestacamento}` la escribe solo la landing (Admin
// SDK); aquí se lee con el Admin SDK y se entrega lo que la pantalla pinta:
// sin el token de la solicitud ni la ruta del comprobante (el comprobante se
// pide aparte, con sesión).
//
// El padrón (destacamentos → iglesia → sección → región) sale de la API .NET
// con su caché, para contar listos y faltantes por región y por sección.
// ----------------------------------------------------------------------

export const COLECCION_MEMBRESIAS = 'membresiasOnerrd2027';

const API = 'https://systexploradores.somee.com/api';
const TIEMPO_MAXIMO_MS = process.env.NODE_ENV === 'development' ? 25_000 : 9_000;

const filasDe = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const pedirLista = async (clave, ruta) => {
  const respuesta = await fetchUpstreamText(clave, `${API}/${ruta}`, {
    timeoutMs: TIEMPO_MAXIMO_MS,
  }).catch(() => null);
  if (!respuesta?.ok || !respuesta.text) return [];
  return filasDe(normalizeApiResponse(JSON.parse(respuesta.text)));
};

const texto = (v) => String(v ?? '').trim();

// Los destacamentos con su región, sección y estado (activo o inactivo).
export async function leerPadronDeDestacamentos(db) {
  const [destacamentos, iglesias, secciones, regiones, estados] = await Promise.all([
    pedirLista(UPSTREAM_KEYS.destacamentos, 'Destacamentos/GetAllDestacamentos'),
    pedirLista(UPSTREAM_KEYS.iglesias, 'Iglesias/GetAllIglesias'),
    pedirLista(UPSTREAM_KEYS.secciones, 'Secciones/GetAllSecciones'),
    pedirLista(UPSTREAM_KEYS.regiones, 'Regiones/GetAllRegiones'),
    db
      .collection(COLECCIONES.estadoDestacamentos)
      .get()
      .then((s) => new Map(s.docs.map((d) => [d.id, d.data()?.estado || 'activo'])))
      .catch(() => new Map()),
  ]);
  const iglesia = new Map(iglesias.map((x) => [String(x.idIglesia), x]));
  const seccion = new Map(secciones.map((x) => [String(x.idSeccion), x]));
  const region = new Map(regiones.map((x) => [String(x.idRegion), x]));
  return destacamentos
    .filter((d) => texto(d.nombre).toLowerCase() !== 'provisional')
    .map((d) => {
      const ig = iglesia.get(String(d.idIglesia)) || {};
      const sec = seccion.get(String(ig.idSeccion)) || {};
      const reg = region.get(String(sec.idRegion)) || {};
      const id = String(d.idDestacamento);
      return {
        id,
        numero: texto(d.numero),
        nombre: texto(d.nombre),
        seccion: texto(sec.nombre),
        region: texto(reg.nombre),
        estado: estados.get(id) || 'activo',
      };
    });
  // Todos (con su estado): un inactivo también paga; la pantalla decide a quién contar.
}

const iso = (v) => (v?.toDate ? v.toDate().toISOString() : typeof v === 'string' ? v : null);

// Lo que la pantalla necesita de cada membresía (sin token ni rutas).
export const membresiaParaPantalla = (id, m) => ({
  id,
  estado: m.estado,
  tipoPago: m.tipoPago,
  codigo: m.codigo || '',
  destacamento: m.destacamento || {},
  plan: m.plan || null,
  montoRd: m.montoRd ?? null,
  vigencia: m.vigencia || null,
  contacto: { email: m.contacto?.email || '', telefono: m.contacto?.telefono || '' },
  deposito: m.deposito
    ? {
        fecha: m.deposito.fecha || '',
        referencia: m.deposito.referencia || '',
        comprobanteTipo: m.deposito.comprobanteTipo || '',
        tieneComprobante: Boolean(m.deposito.comprobanteRuta),
      }
    : null,
  paypal: m.paypal
    ? {
        montoUsd: m.paypal.montoUsd || '',
        tasa: m.paypal.tasa || null,
        orderId: m.paypal.orderId || '',
        captureId: m.pagoConfirmado?.captureId || '',
      }
    : null,
  motivoRechazo: m.motivoRechazo || '',
  correos: m.correos || {},
  // Datos del destacamento corregidos por quien pagó: { campo: { antes, despues } }.
  correcciones: m.correcciones || {},
  // Quién las hizo: { nombre, telefono, idMiembro }.
  corregidoPor: m.corregidoPor || null,
  certificadoEmitido: m.certificadoEmitido || null,
  // Quién registró el destacamento al pagar (lo eligió en la landing).
  registradoPor: m.registradoPor
    ? {
        nombre: m.registradoPor.nombre || '',
        nombres: m.registradoPor.nombres || '',
        apellidos: m.registradoPor.apellidos || '',
        idMiembro: m.registradoPor.idMiembro || '',
      }
    : null,
  creadoEn: iso(m.creadoEn),
  confirmadoEn: iso(m.confirmadoEn),
  actualizadoEn: iso(m.actualizadoEn),
});
