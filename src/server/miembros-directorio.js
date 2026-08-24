import 'server-only';

import { normalizeApiResponse } from 'src/utils/normalize-api-response';
import { UPSTREAM_KEYS, fetchUpstreamText } from 'src/utils/upstream-cache';

// ----------------------------------------------------------------------
// El padron, del lado del servidor.
//
// Las tres pantallas de acceso —entrar, recuperar y primer acceso— necesitaban
// UN dato de UN miembro: con que correo entra, si su ficha tiene correo propio y
// si el correo que escribe ya es de otro. Para resolverlo se descargaban el
// listado ENTERO desde el navegador, y como esas pantallas no tienen sesion,
// `/api/members/` tenia que estar abierta: nombres, correos, telefonos y fechas
// de nacimiento de todos los miembros —menores incluidos— a un `curl` de
// distancia de cualquiera.
//
// Aqui el listado se pide desde el servidor y no sale de el: fuera solo va la
// respuesta concreta que la pantalla necesita.
// ----------------------------------------------------------------------

const URL_MIEMBROS = 'https://systexploradores.somee.com/api/Miembros/GetAllMiembros';

const soloDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');

/** El numero es la parte final del codigo: en `EDR-10011` es 10011. */
export const numeroDeCodigo = (codigo) => {
  const partes = String(codigo ?? '').split('-');

  return soloDigitos(partes[partes.length - 1]);
};

const normalizarCorreo = (correo) =>
  String(correo ?? '')
    .trim()
    .toLowerCase();

/**
 * Todo el padron. Solo para uso interno de este modulo: nada de lo que devuelve
 * debe salir tal cual en una respuesta.
 *
 * Se apoya en el mismo cache que `/api/members/` (particion `anon`, porque la
 * llamada va sin identidad), asi que consultarlo no anade viajes al upstream.
 */
const listarMiembros = async () => {
  const upstream = await fetchUpstreamText(`${UPSTREAM_KEYS.miembros}:anon`, URL_MIEMBROS).catch(
    (error) => {
      console.error('[miembros-directorio] no se pudo leer el padron', error);

      return null;
    }
  );

  if (!upstream?.ok) return [];

  try {
    const { data } = normalizeApiResponse(JSON.parse(upstream.text));

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[miembros-directorio] el padron no vino en JSON', error);

    return [];
  }
};

const codigoDe = (miembro) => String(miembro?.codigoMiembro || miembro?.memberId || '').trim();

/** El miembro que tiene ese numero, o null. */
export const buscarMiembroPorNumero = async (numeroEscrito) => {
  const numero = soloDigitos(numeroEscrito);

  if (!numero) return null;

  const miembros = await listarMiembros();

  return miembros.find((candidato) => numeroDeCodigo(codigoDe(candidato)) === numero) ?? null;
};

/** El miembro con ese codigo completo (`EDR-10011`), o null. */
export const buscarMiembroPorCodigo = async (codigo) => buscarMiembroPorNumero(numeroDeCodigo(codigo));

/** El miembro con ese id, o null. */
export const buscarMiembroPorId = async (idMiembros) => {
  const buscado = String(idMiembros ?? '').trim();

  if (!buscado) return null;

  const miembros = await listarMiembros();

  return (
    miembros.find((candidato) => String(candidato?.idMiembros ?? candidato?.id ?? '') === buscado) ??
    null
  );
};

/**
 * ¿Ese correo ya es de otro miembro?
 *
 * El correo identifica a la persona: con el se recupera la clave y, una vez
 * verificado, se entra. Dos miembros con el mismo se quedan sin forma de
 * distinguirse.
 */
export const correoUsadoPorOtroMiembro = async ({ correo, idMiembros }) => {
  const buscado = normalizarCorreo(correo);

  if (!buscado) return false;

  const propio = String(idMiembros ?? '');
  const miembros = await listarMiembros();

  return miembros.some(
    (miembro) =>
      normalizarCorreo(miembro?.correo || miembro?.email) === buscado &&
      String(miembro?.idMiembros ?? miembro?.id ?? '') !== propio
  );
};

// ----------------------------------------------------------------------
// Donde cae cada destacamento.
//
// Hace falta para responder a "¿este miembro esta bajo el mando de quien
// pregunta?": el miembro trae su destacamento, y de ahi hay que subir a su
// seccion y a su region para compararlas con las casillas del solicitante.
// ----------------------------------------------------------------------

const URL_DESTACAMENTOS = 'https://systexploradores.somee.com/api/Destacamentos/GetAllDestacamentos';
const URL_SECCIONES = 'https://systexploradores.somee.com/api/Secciones/GetAllSecciones';

const idTexto = (valor) => {
  const texto = String(valor ?? '').trim();

  return texto && texto !== '0' ? texto : '';
};

const leerCatalogo = async (clave, url) => {
  const upstream = await fetchUpstreamText(clave, url).catch(() => null);

  if (!upstream?.ok) return [];

  try {
    const { data } = normalizeApiResponse(JSON.parse(upstream.text));

    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

/** `{ idDestacamento, idSeccion, idRegion }` del destacamento indicado. */
export const ubicacionDeDestacamento = async (idDestacamento) => {
  const buscado = idTexto(idDestacamento);
  const vacia = { idDestacamento: buscado, idSeccion: '', idRegion: '' };

  if (!buscado) return vacia;

  const [destacamentos, secciones] = await Promise.all([
    leerCatalogo(UPSTREAM_KEYS.destacamentos, URL_DESTACAMENTOS),
    leerCatalogo(UPSTREAM_KEYS.secciones, URL_SECCIONES),
  ]);

  const destacamento = destacamentos.find(
    (candidato) => idTexto(candidato?.id ?? candidato?.idDestacamento) === buscado
  );

  if (!destacamento) return vacia;

  const idSeccion = idTexto(
    destacamento?.sectionalId ??
      destacamento?.idSeccion ??
      destacamento?.seccionId ??
      destacamento?.sectionId
  );
  const seccion = secciones.find(
    (candidata) => idTexto(candidata?.idSeccion ?? candidata?.id ?? candidata?.sectionalId) === idSeccion
  );

  return {
    idDestacamento: buscado,
    idSeccion,
    idRegion: idTexto(seccion?.regionalId ?? seccion?.idRegion ?? seccion?.regionId),
  };
};

/** Su nombre corto, para poder decirle a quien acudir sin dar la ficha entera. */
export const nombreCortoDeMiembro = (miembro) => {
  const primero = (texto) => String(texto ?? '').trim().split(/\s+/)[0] || '';
  const nombre = primero(miembro?.nombres ?? miembro?.firstName);
  const apellido = primero(miembro?.apellidos ?? miembro?.lastName);
  const corto = [nombre, apellido].filter(Boolean).join(' ');

  return corto || String(miembro?.nombreMiembro || codigoDe(miembro) || '').trim();
};

/** Lo que una pantalla sin sesion puede saber de un miembro: nada personal. */
export const datosMinimosDeMiembro = (miembro) => ({
  idMiembros: Number(miembro?.idMiembros ?? miembro?.id) || null,
  codigoMiembro: codigoDe(miembro),
  correo: normalizarCorreo(miembro?.correo || miembro?.email),
  idDestacamento: Number(miembro?.idDestacamento ?? miembro?.destId) || null,
});
