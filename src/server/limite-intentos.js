import 'server-only';

// ----------------------------------------------------------------------
// Limite de intentos para las rutas de acceso.
//
// Las rutas de `/api/auth` que se pueden llamar SIN sesion son las unicas
// puertas del sistema que un desconocido puede tocar: resolver el correo de un
// miembro, pedir el enlace de recuperacion y probar el codigo del Coordinador.
// Sin limite, esas tres se recorren enteras en minutos —el padron completo de
// correos, o los cinco intentos que agotan el codigo de cada miembro—.
//
// La cuenta vive en memoria del proceso. En Netlify cada instancia lleva la
// suya, asi que el limite real es el de aqui multiplicado por el numero de
// instancias vivas: frena el barrido automatico, que es de lo que se trata, pero
// NO sustituye a un limite de verdad en el borde (Netlify Rate Limiting, o
// Firebase App Check, que ademas exige que la llamada venga de la aplicacion).
// ----------------------------------------------------------------------

// globalThis para no perder la cuenta con el hot-reload del servidor de
// desarrollo, igual que hace `upstream-cache`.
const obtenerRegistro = () => {
  if (!globalThis.__limiteIntentosAcceso) {
    globalThis.__limiteIntentosAcceso = new Map();
  }

  return globalThis.__limiteIntentosAcceso;
};

// Cada cuanto se tira lo viejo. Sin esto el mapa crece con cada IP que pasa.
const LIMPIEZA_CADA = 5 * 60 * 1000;
let ultimaLimpieza = 0;

const limpiar = (registro, ahora) => {
  if (ahora - ultimaLimpieza < LIMPIEZA_CADA) return;

  ultimaLimpieza = ahora;

  for (const [clave, marcas] of registro.entries()) {
    const vivas = marcas.filter((marca) => marca > ahora - 60 * 60 * 1000);

    if (vivas.length) {
      registro.set(clave, vivas);
    } else {
      registro.delete(clave);
    }
  }
};

/**
 * De donde viene la llamada.
 *
 * Detras de Netlify la direccion real es la primera de `x-forwarded-for`; el
 * resto de la lista son los proxys por los que paso y el cliente puede
 * inventarselos, asi que solo se mira la primera.
 */
export const origenDe = (req) => {
  const cabecera =
    req.headers.get('x-nf-client-connection-ip') ||
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    '';

  return String(cabecera).split(',')[0].trim() || 'desconocido';
};

/**
 * ¿Se pasó de intentos?
 *
 * Devuelve `null` si puede seguir, o una Response 429 lista para devolver. Se
 * cuenta por ventana deslizante: cuantas llamadas hubo en los ultimos
 * `ventanaMs` con esa misma clave.
 */
export const limiteSuperado = (
  req,
  { grupo, identificador = '', maximo = 10, ventanaMs = 60 * 1000, porOrigen = true } = {}
) => {
  const registro = obtenerRegistro();
  const ahora = Date.now();

  limpiar(registro, ahora);

  // `porOrigen: false` cuenta el identificador venga de donde venga. Es lo que
  // hace falta cuando lo que se protege es el objetivo y no el atacante: contra
  // el codigo de un miembro, repartir los intentos entre mil direcciones es
  // justo lo que haria quien quiera agotarlo.
  const clave = [grupo, porOrigen ? origenDe(req) : 'global', String(identificador || '').toLowerCase()].join(
    ':'
  );
  const marcas = (registro.get(clave) ?? []).filter((marca) => marca > ahora - ventanaMs);

  if (marcas.length >= maximo) {
    const esperaSegundos = Math.max(1, Math.ceil((marcas[0] + ventanaMs - ahora) / 1000));

    return Response.json(
      { error: 'Demasiados intentos. Espera un momento y vuelve a probar.' },
      { status: 429, headers: { 'Retry-After': String(esperaSegundos) } }
    );
  }

  marcas.push(ahora);
  registro.set(clave, marcas);

  return null;
};
