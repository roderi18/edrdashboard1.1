import 'server-only';

import * as z from 'zod';
import { FieldValue } from 'firebase-admin/firestore';

import { db, bucket } from './firebase.mjs';
import { leerSecciones, codigoDeMiembro, leerDestacamentos, leerMiembroParaComparar } from './datos.mjs';

// ----------------------------------------------------------------------
// GUARDAR UN ENVÍO (solo servidor).
//
// Lo que manda un directivo NO toca el padrón: queda "pendiente" en
// `actualizaciones_destacamentos` hasta que el Administrador Global o la
// Oficina Nacional lo revisen en el dashboard. El "antes" se vuelve a leer aquí
// del padrón —no se fía del navegador— y se guarda quién lo envió.
// ----------------------------------------------------------------------

export const COLECCION = 'actualizaciones_destacamentos';
export const CARPETA_LOGOS = 'actualizaciones-destacamentos';

const t = (max = 120) => z.string().trim().max(max);
// Máximo 10 dígitos sin el código del país (+1): como los guarda el padrón.
const telefono = z
  .string()
  .trim()
  .regex(/^\+?[\d\s()-]{7,20}$/, 'Teléfono no válido')
  .refine((v) => {
    const d = v.replace(/\D/g, '');
    return (v.startsWith('+1') || d.length === 11 ? d.replace(/^1/, '') : d).length <= 10;
  }, 'El teléfono debe tener como máximo 10 dígitos');

export const EsquemaEnvio = z.object({
  trampa: z.string().max(200).optional().default(''), // campo oculto: si viene lleno, es un bot
  remitente: z.object({
    idMiembro: z.union([z.number(), z.string()]).nullable().optional(),
    nombres: t(60).min(2),
    apellidos: t(60).min(2),
    telefono,
    posicion: t(80).min(2),
  }),
  destacamento: z.object({
    id: z.union([z.number(), z.string()]).nullable().optional(),
    idSeccion: z.union([z.number(), z.string()]).nullable().optional(),
  }),
  // "Tus datos de miembro" (todo opcional).
  miembro: z
    .object({
      nombres: t(60).optional().default(''),
      apellidos: t(60).optional().default(''),
      fechaNacimiento: z
        .string()
        .regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Fecha no válida')
        .optional()
        .default(''),
      direccion: z
        .object({
          provincia: t(60).optional().default(''),
          municipio: t(80).optional().default(''),
          sector: t(100).optional().default(''),
          calle: t(120).optional().default(''),
        })
        .optional()
        .default({}),
      sexo: z.enum(['', 'M', 'F']).optional().default(''),
      talla: t(5).optional().default(''),
      cargoNacional: t(100).optional().default(''),
      posicionDestacamento: t(100).optional().default(''),
    })
    .optional()
    .nullable(),
  datos: z.object({
    nombre: t(100).min(2),
    numero: t(6).regex(/^\d*$/, 'Solo números').optional().default(''),
    iglesia: t(120).min(2),
    cantidadMiembros: z.coerce.number().int().min(0).max(2000).nullable().optional(),
    direccion: z.object({
      provincia: t(60).min(2),
      municipio: t(80).min(2),
      sector: t(100).optional().default(''),
      calle: t(120).optional().default(''),
      referencia: t(160).optional().default(''),
    }),
    pastor: z.object({ nombre: t(100).min(2), telefono: telefono.or(z.literal('')).optional().default('') }),
    coordinador: z.object({
      idMiembro: z.union([z.number(), z.string()]).nullable().optional(),
      nombres: t(60).min(2),
      apellidos: t(60).min(2),
      telefono: telefono.or(z.literal('')).optional().default(''),
    }),
    registradoOfnc: z.boolean(),
    rritrackActivo: z.boolean(),
    diaReunion: t(20).min(2),
    horaReunion: t(10).regex(/^\d{2}:\d{2}$/, 'Hora no válida'),
  }),
});

// ------------------------------------------------ límite de envíos por dispositivo
const envios = new Map();
const LIMITE = 8; // por hora y por IP
export function superaLimite(ip) {
  const ahora = Date.now();
  const recientes = (envios.get(ip) || []).filter((m) => ahora - m < 60 * 60 * 1000);
  recientes.push(ahora);
  envios.set(ip, recientes);
  return recientes.length > LIMITE;
}

const LOGO_TIPOS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const LOGO_MAX = 2 * 1024 * 1024;

const cambiosEntre = (antes, despues) => {
  const plano = (o, pre = '') =>
    Object.entries(o || {}).flatMap(([k, v]) =>
      v && typeof v === 'object' && !Array.isArray(v) ? plano(v, `${pre}${k}.`) : [[`${pre}${k}`, v]]
    );
  const a = Object.fromEntries(plano(antes));
  return plano(despues)
    .filter(([k, v]) => String(a[k] ?? '') !== String(v ?? ''))
    .map(([campo, despues_]) => ({ campo, antes: a[campo] ?? null, despues: despues_ ?? null }));
};

// Sube una imagen del envío con token de descarga (el dashboard la usa tal cual).
async function subirImagen(ref, archivo, nombre) {
  const ext = LOGO_TIPOS[archivo.type];
  if (!ext) throw new Error('La imagen debe ser PNG, JPG o WEBP.');
  if (archivo.size > LOGO_MAX) throw new Error('La imagen pesa más de 2 MB.');
  const ruta = `${CARPETA_LOGOS}/${ref.id}/${nombre}.${ext}`;
  const token = globalThis.crypto.randomUUID();
  const b = bucket();
  await b.file(ruta).save(Buffer.from(await archivo.arrayBuffer()), {
    contentType: archivo.type,
    resumable: false,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
  const url = `https://firebasestorage.googleapis.com/v0/b/${b.name}/o/${encodeURIComponent(ruta)}?alt=media&token=${token}`;
  return { ruta, url, tipo: archivo.type, tamano: archivo.size };
}

export async function guardarEnvio({ envio, logo, fotoMiembro, ip }) {
  const destacamentos = await leerDestacamentos();
  const secciones = await leerSecciones();
  const existente = envio.destacamento.id
    ? destacamentos.find((d) => String(d.id) === String(envio.destacamento.id))
    : null;
  if (envio.destacamento.id && !existente) throw new Error('El destacamento elegido no existe.');

  const idSeccion = existente?.idSeccion ?? envio.destacamento.idSeccion;
  const seccion = secciones.find((s) => String(s.id) === String(idSeccion));
  if (!seccion) throw new Error('Elige la sección del destacamento.');

  // Lo registrado hoy, con la misma forma que los datos enviados.
  const antes = existente
    ? {
        nombre: existente.nombre,
        numero: existente.numero,
        iglesia: existente.iglesia,
        direccion: { ...existente.direccion },
        pastor: { nombre: existente.pastor },
        coordinador: { nombre: existente.coordinador?.nombre || '' },
        registradoOfnc: existente.registradoOfnc,
        rritrackActivo: existente.rritrackActivo,
        diaReunion: existente.diaReunion,
        horaReunion: existente.horaReunion,
      }
    : null;
  const { datos } = envio;
  const comparable = {
    ...datos,
    coordinador: { nombre: `${datos.coordinador.nombres} ${datos.coordinador.apellidos}`.trim() },
    pastor: { nombre: datos.pastor.nombre },
  };

  const ref = db().collection(COLECCION).doc();
  const logoGuardado = logo ? await subirImagen(ref, logo, 'logo') : null;
  const fotoMiembroGuardada = fotoMiembro ? await subirImagen(ref, fotoMiembro, 'foto-miembro') : null;

  // Lo registrado hoy del miembro que envía, para ver qué cambia. Se lee aquí
  // (con fecha y dirección) y nunca vuelve al navegador.
  const idRemitente = envio.remitente.idMiembro;
  const miembroAntes = idRemitente ? await leerMiembroParaComparar(idRemitente).catch(() => null) : null;
  // Lo vacío no cuenta como cambio: en el formulario significa "no lo toco".
  const soloLleno = (o) =>
    Object.fromEntries(
      Object.entries(o || {})
        .map(([k, v]) => [k, v && typeof v === 'object' ? soloLleno(v) : v])
        .filter(([, v]) => (v && typeof v === 'object' ? Object.keys(v).length : v !== '' && v != null))
    );
  const miembroEnviado = envio.miembro ? soloLleno(envio.miembro) : null;

  // El código del miembro lo pone el servidor: el navegador nunca lo ve ni lo manda.
  const [codigoRemitente, codigoCoordinador] = await Promise.all([
    codigoDeMiembro(envio.remitente.idMiembro).catch(() => null),
    codigoDeMiembro(envio.datos.coordinador.idMiembro).catch(() => null),
  ]);
  const nombreRemitente = `${envio.remitente.nombres} ${envio.remitente.apellidos}`.trim();
  await ref.set({
    id: ref.id,
    estado: 'pendiente',
    origen: 'errd-registro',
    esNuevo: !existente,
    creadoEn: FieldValue.serverTimestamp(),
    enviadoPor: {
      nombre: nombreRemitente,
      idMiembro: envio.remitente.idMiembro ? String(envio.remitente.idMiembro) : null,
      esPersonaNueva: !envio.remitente.idMiembro,
      codigoMiembro: codigoRemitente,
      telefono: envio.remitente.telefono,
      posicion: envio.remitente.posicion,
    },
    destacamento: { id: existente ? String(existente.id) : null, nombre: datos.nombre, numero: datos.numero || '' },
    nombreDestacamento: datos.nombre,
    numeroDestacamento: datos.numero || '',
    seccion: { id: String(seccion.id), nombre: seccion.nombre },
    region: { id: String(seccion.idRegion ?? ''), nombre: seccion.region },
    datos: { ...datos, coordinador: { ...datos.coordinador, codigoMiembro: codigoCoordinador } },
    antes,
    cambios: antes ? cambiosEntre(antes, comparable) : [],
    logo: logoGuardado,
    miembro: miembroEnviado,
    miembroAntes,
    cambiosMiembro: miembroAntes && miembroEnviado ? cambiosEntre(miembroAntes, miembroEnviado) : [],
    fotoMiembro: fotoMiembroGuardada,
    // Solo para detectar abusos; no es un dato de la persona.
    ipAproximada: String(ip || '').split(',')[0].trim().replace(/\.\d+$/, '.x'),
  });

  return { id: ref.id };
}
