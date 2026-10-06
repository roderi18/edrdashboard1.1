// ----------------------------------------------------------------------
// AUDITORIA DE SEGURIDAD: que se registra, con que forma y que NUNCA entra.
//
// Que se rompia: las 16 rutas de `/api/auth` y `/api/admin` no dejaban rastro.
// Generar un codigo de recuperacion, entrar con el, cambiar la contraseña o el
// correo de acceso (que es quedarse con la cuenta), repartir roles o entrar como
// otra persona pasaba sin constancia. Lo poco que habia era `console.*` suelto,
// solo cuando algo fallaba, y la auditoria de negocio (`auditoria_sistema`) la
// escribe el navegador: quien se salta la pantalla, no la genera.
//
// Aqui vive la parte pura (sin Firebase): el catalogo de acciones, la forma del
// evento y la limpieza de lo que no puede guardarse. La escritura en Firestore
// esta en `src/server/auditoria-seguridad.js`. Detalle en
// `docs/auditoria-de-seguridad.md`.
// ----------------------------------------------------------------------

export const ACCIONES_DE_SEGURIDAD = Object.freeze({
  // Recuperacion de acceso
  codigoGenerado: 'codigo_recuperacion_generado',
  codigoDenegado: 'codigo_recuperacion_denegado',
  accesoConCodigo: 'acceso_con_codigo',
  codigoCongelado: 'codigo_recuperacion_congelado',
  recuperacionConsultada: 'recuperacion_consultada',
  ayudaCoordinadorSolicitada: 'ayuda_coordinador_solicitada',
  correoDeAccesoConsultado: 'correo_de_acceso_consultado',
  // Cuenta
  claveCambiada: 'clave_cambiada',
  correoCambiado: 'correo_acceso_cambiado',
  correoDenegado: 'correo_acceso_denegado',
  cuentaCreada: 'cuenta_creada',
  sesionIniciada: 'sesion_iniciada',
  // Roles y claims
  rolAdministracionAsignado: 'rol_administracion_asignado',
  rolAdministracionDenegado: 'rol_administracion_denegado',
  claimsFijados: 'claims_fijados',
  rolPropioCambiado: 'rol_propio_cambiado',
  rolesSincronizados: 'roles_sincronizados',
  rolSincronizado: 'rol_sincronizado',
  administradorGlobalCreado: 'administrador_global_creado',
  // Suplantacion
  suplantacionIniciada: 'suplantacion_iniciada',
  suplantacionTerminada: 'suplantacion_terminada',
  suplantacionDenegada: 'suplantacion_denegada',
  // Defensa
  limiteSuperado: 'limite_superado',
  accesoDenegado: 'acceso_denegado',
  sesionRevocadaUsada: 'sesion_revocada_usada',
  // Lecturas masivas
  padronConsultado: 'padron_consultado',
});

const ACCIONES_VALIDAS = new Set(Object.values(ACCIONES_DE_SEGURIDAD));

export const RESULTADOS_DE_SEGURIDAD = Object.freeze(['ok', 'fallo', 'denegado', 'bloqueado']);

// Cuanto se guarda cada evento. `expiraEn` es el campo de la politica TTL de
// Firestore (se activa una vez, ver el documento); sin ella no se borra nada.
export const RETENCION_DIAS = 400;

// Lo que NUNCA puede acabar en un registro, venga en el nivel que venga: con
// esto en la mano se entra en la cuenta. `codigoMiembro` si vale (es publico);
// `codigo` a secas es el de un solo uso.
const CLAVE_PROHIBIDA =
  /^(clave|claveNueva|claveRepetida|password|contrasena|contraseña|token|accessToken|idToken|refreshToken|customToken|codigo|secreto|secret|sal|huella)$/i;

const LARGO_MAXIMO_TEXTO = 300;
const PROFUNDIDAD_MAXIMA = 3;
const ELEMENTOS_MAXIMOS = 20;

/** Copia `valor` sin secretos, con textos cortos y sin anidar de mas. */
export const limpiarDetalle = (valor, profundidad = 0) => {
  if (valor === undefined || valor === null) return null;

  if (typeof valor === 'string') {
    return valor.length > LARGO_MAXIMO_TEXTO ? `${valor.slice(0, LARGO_MAXIMO_TEXTO)}…` : valor;
  }

  if (typeof valor === 'number' || typeof valor === 'boolean') return valor;

  if (valor instanceof Date) return valor.toISOString();

  if (profundidad >= PROFUNDIDAD_MAXIMA) return '[omitido]';

  if (Array.isArray(valor)) {
    return valor.slice(0, ELEMENTOS_MAXIMOS).map((item) => limpiarDetalle(item, profundidad + 1));
  }

  if (typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor)
        .filter(([clave]) => !CLAVE_PROHIBIDA.test(clave))
        .slice(0, ELEMENTOS_MAXIMOS)
        .map(([clave, item]) => [clave, limpiarDetalle(item, profundidad + 1)])
    );
  }

  return String(valor);
};

const texto = (valor) => {
  const limpio = String(valor ?? '').trim();

  return limpio ? limpio.slice(0, 128) : null;
};

/** Quien hizo algo o a quien se le hizo: solo identificadores. */
export const normalizarPersona = (persona) => {
  if (!persona) return null;

  return {
    uid: texto(persona.uid),
    idMiembros: texto(persona.idMiembros),
    codigoMiembro: texto(persona.codigoMiembro),
    correo: texto(persona.correo ?? persona.email),
    rol: texto(persona.rol),
  };
};

/**
 * El evento tal como se guarda. Lanza si la accion o el resultado no son del
 * catalogo: un nombre mal escrito haria el registro imposible de consultar.
 */
export const construirEventoDeSeguridad = ({
  accion,
  resultado = 'ok',
  actor = null,
  objetivo = null,
  detalle = null,
  ip = null,
  userAgent = null,
  ruta = null,
  ahora = Date.now(),
} = {}) => {
  if (!ACCIONES_VALIDAS.has(accion)) {
    throw new Error(`Accion de seguridad desconocida: ${accion}`);
  }

  if (!RESULTADOS_DE_SEGURIDAD.includes(resultado)) {
    throw new Error(`Resultado de seguridad desconocido: ${resultado}`);
  }

  return {
    accion,
    resultado,
    actor: normalizarPersona(actor),
    objetivo: normalizarPersona(objetivo),
    detalle: limpiarDetalle(detalle),
    ip: texto(ip),
    userAgent: texto(userAgent),
    ruta: texto(ruta),
    fecha: new Date(ahora).toISOString(),
    expiraEn: new Date(ahora + RETENCION_DIAS * 24 * 60 * 60 * 1000),
  };
};

/** Severidad para Cloud Logging: lo que no salio bien se ve como advertencia. */
export const severidadDe = (resultado) => (resultado === 'ok' ? 'INFO' : 'WARNING');

/**
 * Una linea JSON en los logs del servidor. Cloud Logging reconoce `severity` y
 * `message`, asi que se puede filtrar por `jsonPayload.accion`. Pasa SIEMPRE,
 * aunque Firestore no responda: es la copia que no depende de nada.
 */
export const escribirEnLogDelServidor = (evento, escribir = console.info) => {
  // La fecha de caducidad solo le sirve a Firestore (politica TTL).
  const resto = { ...evento };

  delete resto.expiraEn;

  escribir(
    JSON.stringify({
      severity: severidadDe(evento.resultado),
      message: `[seguridad] ${evento.accion} ${evento.resultado}`,
      tipo: 'auditoria_seguridad',
      ...resto,
    })
  );
};

/** Lo que dice la propia peticion: IP real, navegador y ruta. */
export const contextoDePeticion = (req, ipDe) => {
  let ruta = null;

  try {
    ruta = req?.url ? new URL(req.url).pathname : null;
  } catch {
    ruta = null;
  }

  return {
    ip: ipDe ? ipDe(req) : null,
    userAgent: req?.headers?.get?.('user-agent') ?? null,
    ruta,
  };
};

/**
 * Solo la linea de log, sin Firestore. Para las rutas que no cargan el Admin SDK
 * (`/api/members`, a proposito) y para lo que se repite tanto que guardarlo
 * entero no compensa. Nunca lanza.
 */
export const registrarEnLogDelServidor = (req, datos, { ipDe = null, repeticion = null } = {}) => {
  try {
    if (repeticion && !unaVezCada(repeticion.clave, repeticion.ms)) return null;

    const evento = construirEventoDeSeguridad({ ...datos, ...contextoDePeticion(req, ipDe) });

    escribirEnLogDelServidor(evento);

    return evento;
  } catch (error) {
    console.error('[auditoria-seguridad] evento descartado', {
      accion: datos?.accion,
      mensaje: error?.message,
    });

    return null;
  }
};

// ¿Toca registrar esto, o ya se registro hace poco? Para lo que se repite en
// rafaga —un barrido que choca con el limite cien veces, la misma pantalla que
// vuelve a pedir el padron—: una vez por ventana basta para saber que pasa, y
// escribir cada repeticion seria pagarle al atacante por atacar.
export const unaVezCada = (clave, ventanaMs, ahora = Date.now()) => {
  if (!globalThis.__auditoriaSeguridadVistas) {
    globalThis.__auditoriaSeguridadVistas = new Map();
  }

  const vistas = globalThis.__auditoriaSeguridadVistas;
  const ultima = vistas.get(clave);

  if (ultima !== undefined && ahora - ultima < ventanaMs) return false;

  if (vistas.size > 10000) vistas.clear();
  vistas.set(clave, ahora);

  return true;
};
