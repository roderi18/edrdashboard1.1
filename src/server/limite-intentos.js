import 'server-only';

import { ipDelCliente } from 'src/server/ip-del-cliente.mjs';
import { ACCIONES_DE_SEGURIDAD, registrarEventoDeSeguridad } from 'src/server/auditoria-seguridad';

// ----------------------------------------------------------------------
// Limite de intentos para las rutas de acceso.
//
// Las rutas de `/api/auth` que se pueden llamar SIN sesion son las unicas
// puertas del sistema que un desconocido puede tocar: resolver el correo de un
// miembro, pedir el enlace de recuperacion y probar el codigo del Coordinador.
// Sin limite, esas tres se recorren enteras en minutos —el padron completo de
// correos, o los cinco intentos que agotan el codigo de cada miembro—.
//
// La cuenta vive en memoria del proceso. En App Hosting cada instancia lleva la
// suya, asi que el limite real es el de aqui multiplicado por el numero de
// instancias vivas: frena el barrido automatico, que es de lo que se trata, pero
// NO sustituye a un limite de verdad en el borde (Cloud Armor, o Firebase App
// Check, que ademas exige que la llamada venga de la aplicacion). Lo que no
// puede depender de una sola instancia —los intentos contra el codigo de un
// miembro— se cuenta en Firestore (`registrarFalloDeCodigo`).
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

// De donde viene la llamada: la IP real, leida desde la derecha de
// `x-forwarded-for` (ver `ip-del-cliente.mjs`). Antes se tomaba la primera
// entrada —la que inventa el cliente— y bastaba cambiarla para saltarse el limite.
export const origenDe = ipDelCliente;

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

    // Que alguien choque con el limite es la señal de un barrido, y antes no
    // quedaba en ninguna parte. Una vez por clave y ventana: escribir cada
    // rechazo seria pagarle al atacante por atacar. Sin esperar —esta funcion
    // responde al momento—; el registro no tumba nada si falla.
    void registrarEventoDeSeguridad(
      req,
      {
        accion: ACCIONES_DE_SEGURIDAD.limiteSuperado,
        resultado: 'bloqueado',
        detalle: { grupo, identificador: identificador || null, maximo, ventanaMs },
      },
      { unaVezCada: { clave: `limite:${clave}`, ms: ventanaMs } }
    );

    return Response.json(
      { error: 'Demasiados intentos. Espera un momento y vuelve a probar.' },
      { status: 429, headers: { 'Retry-After': String(esperaSegundos) } }
    );
  }

  marcas.push(ahora);
  registro.set(clave, marcas);

  return null;
};
