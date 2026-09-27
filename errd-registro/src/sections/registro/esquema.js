import * as z from 'zod';
import { parsePhoneNumber } from 'react-phone-number-input';

// ----------------------------------------------------------------------
// Validación del formulario en el navegador (la de verdad se repite en el
// servidor, en src/server/envios.mjs). Cada paso valida solo sus campos.
// ----------------------------------------------------------------------

const requerido = (msg) => z.string().trim().min(2, msg);
// Máximo 10 dígitos sin contar el código del país (+1 en RD): 809 555 1234.
export const digitosNacionales = (v) => {
  try {
    return parsePhoneNumber(String(v))?.nationalNumber?.length ?? String(v).replace(/\D/g, '').length;
  } catch {
    return String(v).replace(/\D/g, '').length;
  }
};
const telefonoValido = (v) => !v || digitosNacionales(v) === 10;

export const PASOS = [
  { id: 'quien', titulo: '¿Quién llena el formulario?', corto: 'Tus datos', icono: 'solar:user-id-bold' },
  { id: 'general', titulo: 'Información general', corto: 'Información general', icono: 'solar:file-text-bold' },
  { id: 'ubicacion', titulo: 'Ubicación de la iglesia', corto: 'Ubicación', icono: 'mingcute:location-fill' },
  { id: 'lideres', titulo: 'Líderes y contacto', corto: 'Líderes y contacto', icono: 'solar:users-group-rounded-bold' },
  { id: 'reuniones', titulo: 'Registro y reuniones', corto: 'Horario y reuniones', icono: 'solar:calendar-date-bold' },
  { id: 'confirmacion', titulo: 'Confirmación', corto: 'Confirmación', icono: 'solar:check-circle-bold' },
];

// Qué campos valida cada paso (para `trigger`).
export const CAMPOS_DEL_PASO = {
  // El destacamento va en el mismo paso, debajo del nombre (se pone solo).
  quien: ['remitente', 'destacamento', 'miembro'],
  general: ['datos.nombre', 'datos.numero', 'datos.iglesia', 'datos.cantidadMiembros'],
  ubicacion: ['datos.direccion'],
  lideres: ['datos.pastor', 'datos.coordinador'],
  reuniones: ['datos.registradoOfnc', 'datos.rritrackActivo', 'datos.diaReunion', 'datos.horaReunion'],
  confirmacion: [],
};

export const Esquema = z
  .object({
    trampa: z.string().optional(),
    remitente: z.object({
      modo: z.enum(['existente', 'nuevo']),
      miembro: z.object({ id: z.any(), nombre: z.string() }).nullable(),
      nombres: z.string().trim(),
      apellidos: z.string().trim(),
      telefono: z.string().trim().refine((v) => telefonoValido(v) && v, 'Escribe tu teléfono'),
      // Sale de "Nivel posición en tu Destacamento" al enviar (ya no hay otra lista).
      posicion: z.string().trim(),
    }),
    destacamento: z.object({
      modo: z.enum(['existente', 'nuevo']),
      elegido: z.any().nullable(),
      idSeccion: z.any().nullable(),
    }),
    logo: z.any().nullable(),
    // "Tus datos de miembro": todo opcional; lo que se deje vacío no cambia.
    miembro: z.object({
      foto: z.any().nullable(),
      nombres: z.string().trim().max(60),
      apellidos: z.string().trim().max(60),
      fechaNacimiento: z.any().nullable(),
      direccion: z.object({
        provincia: z.string().trim(),
        municipio: z.string().trim(),
        sector: z.string().trim(),
        calle: z.string().trim().max(120),
      }),
      sexo: z.string(),
      talla: z.string(),
      cargoNacional: z.string(),
      posicionDestacamento: z.string().min(1, 'Elige tu posición en el destacamento'),
    }),
    datos: z.object({
      nombre: requerido('Escribe el nombre del destacamento'),
      numero: z.string().trim().regex(/^\d{0,6}$/, 'Solo números'),
      iglesia: requerido('Escribe el nombre de la iglesia'),
      cantidadMiembros: z.union([z.number().int().min(0).max(2000), z.literal(''), z.null()]).optional(),
      direccion: z.object({
        provincia: requerido('Elige la provincia'),
        municipio: requerido('Elige el municipio'),
        sector: z.string().trim(),
        calle: z.string().trim(),
        referencia: z.string().trim(),
      }),
      pastor: z.object({
        nombre: requerido('Escribe el nombre del pastor'),
        telefono: z.string().trim().refine(telefonoValido, 'El teléfono debe tener 10 dígitos'),
      }),
      coordinador: z.object({
        modo: z.enum(['existente', 'nuevo']),
        miembro: z.object({ id: z.any(), nombre: z.string() }).nullable(),
        nombres: z.string().trim(),
        apellidos: z.string().trim(),
        telefono: z.string().trim().refine(telefonoValido, 'El teléfono debe tener 10 dígitos'),
      }),
      registradoOfnc: z.boolean({ error: 'Elige Sí o No' }).nullable().refine((v) => v !== null, 'Elige Sí o No'),
      rritrackActivo: z.boolean({ error: 'Elige Sí o No' }).nullable().refine((v) => v !== null, 'Elige Sí o No'),
      diaReunion: requerido('Elige el día'),
      horaReunion: z.any().refine((v) => Boolean(v), 'Elige el horario'),
    }),
  })
  .superRefine((valor, ctx) => {
    const persona = (p, ruta) => {
      if (p.modo === 'existente' && !p.miembro)
        ctx.addIssue({ code: 'custom', path: [...ruta, 'miembro'], message: 'Búscala o pulsa "No está en la lista"' });
      if (p.modo === 'nuevo') {
        if (p.nombres.length < 2) ctx.addIssue({ code: 'custom', path: [...ruta, 'nombres'], message: 'Escribe el nombre' });
        if (p.apellidos.length < 2)
          ctx.addIssue({ code: 'custom', path: [...ruta, 'apellidos'], message: 'Escribe el apellido' });
      }
    };
    persona(valor.remitente, ['remitente']);
    persona(valor.datos.coordinador, ['datos', 'coordinador']);
    if (valor.destacamento.modo === 'existente' && !valor.destacamento.elegido)
      ctx.addIssue({ code: 'custom', path: ['destacamento', 'elegido'], message: 'Elige tu destacamento' });
    if (valor.destacamento.modo === 'nuevo' && !valor.destacamento.idSeccion)
      ctx.addIssue({ code: 'custom', path: ['destacamento', 'idSeccion'], message: 'Elige la sección' });
  });

export const valoresIniciales = {
  trampa: '',
  remitente: { modo: 'existente', miembro: null, nombres: '', apellidos: '', telefono: '', posicion: '' },
  destacamento: { modo: 'existente', elegido: null, idSeccion: null },
  logo: null,
  miembro: {
    foto: null,
    nombres: '',
    apellidos: '',
    fechaNacimiento: null,
    direccion: { provincia: '', municipio: '', sector: '', calle: '' },
    sexo: '',
    talla: '',
    cargoNacional: '',
    posicionDestacamento: '',
  },
  datos: {
    nombre: '',
    numero: '',
    iglesia: '',
    cantidadMiembros: '',
    direccion: { provincia: '', municipio: '', sector: '', calle: '', referencia: '' },
    pastor: { nombre: '', telefono: '' },
    coordinador: { modo: 'existente', miembro: null, nombres: '', apellidos: '', telefono: '' },
    registradoOfnc: null,
    rritrackActivo: null,
    diaReunion: '',
    horaReunion: null,
  },
};
