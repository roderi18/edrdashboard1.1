import {
  ESTADOS_SALUD,
  UMBRALES_SALUD,
  COLECCION_SALUD,
  estadoPorUmbral,
  LIMITE_STORAGE_BYTES,
} from '../../utils/salud-sistema.mjs';

// ----------------------------------------------------------------------
// LAS REVISIONES DE SALUD, DESDE EL SERVIDOR (Admin SDK).
//
// Lo mismo que miraba la pantalla de Salud —Firebase, la API .NET, Storage,
// respaldo, notificaciones, auditoría y colecciones— más lo que el navegador no
// podía ver: que Firestore ESCRIBE (no solo lee), que Auth responde, el peso real
// de Storage (la pantalla usaba un resumen guardado en la pestaña) y CADA
// servicio de la API .NET, no solo el de Miembros.
//
// Recibe sus conexiones (`db`, `auth`, `bucket`, `fetch`) para que lo usen igual
// la tarea programada y la prueba a mano. Un chequeo que revienta no tumba a los
// demás: se convierte en un chequeo crítico con su mensaje.
// ----------------------------------------------------------------------

const API = 'https://systexploradores.somee.com/api';

// Los servicios de la API .NET que lee la aplicación (padrón heredado).
export const SERVICIOS_API = [
  { id: 'miembros', nombre: 'Miembros', ruta: '/Miembros/GetAllMiembros' },
  { id: 'destacamentos', nombre: 'Destacamentos', ruta: '/Destacamentos/GetAllDestacamentos' },
  { id: 'secciones', nombre: 'Secciones', ruta: '/Secciones/GetAllSecciones' },
  { id: 'regiones', nombre: 'Regiones', ruta: '/Regiones/GetAllRegiones' },
  { id: 'iglesias', nombre: 'Iglesias', ruta: '/Iglesias/GetAllIglesias' },
  { id: 'divisiones', nombre: 'Divisiones', ruta: '/Divisiones/GetAllDivisiones' },
  { id: 'paises', nombre: 'Países', ruta: '/Paises/GetListPaises' },
];

// Una colección por módulo: si una REQUERIDA se queda vacía, algo se borró.
export const COLECCIONES_POR_MODULO = [
  { id: 'usuarios_roles', modulo: 'Cuentas y roles', requerida: true },
  { id: 'admins', modulo: 'Administradores', requerida: true },
  { id: 'asignacionesDirectiva', modulo: 'Directivas', requerida: true },
  { id: 'auditoria_sistema', modulo: 'Auditoría', requerida: true },
  { id: 'productos', modulo: 'Tienda', requerida: true },
  { id: 'notificaciones', modulo: 'Notificaciones' },
  { id: 'conversaciones_chat', modulo: 'Chat' },
  { id: 'publicaciones', modulo: 'Muro' },
  { id: 'asistencias', modulo: 'Asistencia' },
  { id: 'recibos', modulo: 'Recibos de la tienda' },
  { id: 'itemsAscenso', modulo: 'Sistema de Ascenso' },
  { id: 'informacion_medica_basica_miembros', modulo: 'Salud del miembro' },
  { id: 'fotos', modulo: 'Fotos' },
  { id: 'cintas_miembros', modulo: 'Insignias' },
  { id: 'everest_publicado', modulo: 'Portada (EXPLORA Designer)' },
  { id: 'gestorArchivos', modulo: 'Gestor de archivos' },
];

const ms = (inicio) => Date.now() - inicio;
const segundos = (milis) => `${(milis / 1000).toFixed(1).replace('.', ',')} s`;
const megas = (bytes) => `${(bytes / 1024 ** 2).toFixed(1).replace('.', ',')} MB`;

const chequeo = (base) => ({ value: '', resumen: '', ...base });

/** Corre un chequeo; si revienta, sale crítico con el motivo en vez de tumbar la revisión. */
const seguro = async (base, fn) => {
  try {
    return chequeo({ ...base, ...(await fn()) });
  } catch (error) {
    const motivo = String(error?.message || error || 'error desconocido').slice(0, 200);

    return chequeo({
      ...base,
      status: ESTADOS_SALUD.critico,
      value: 'Error',
      detail: `No respondió: ${motivo}.`,
      resumen: `no responde (${motivo})`,
    });
  }
};

// ---------------------------------------------------------------- Firebase

const chequeoFirestore = (db) =>
  seguro({ id: 'firebase_firestore', area: 'Firebase', name: 'Firestore' }, async () => {
    const inicio = Date.now();
    const referencia = db.collection(COLECCION_SALUD).doc('latido');

    // Escribir Y leer: con cuota agotada o reglas rotas, leer puede seguir
    // funcionando mientras las escrituras fallan.
    await referencia.set({ fecha: new Date().toISOString() }, { merge: true });
    await referencia.get();
    const tiempo = ms(inicio);

    return {
      status:
        tiempo > UMBRALES_SALUD.firebaseLentoMs
          ? ESTADOS_SALUD.advertencia
          : ESTADOS_SALUD.correcto,
      value: `${tiempo} ms`,
      detail: `Escribe y lee en ${tiempo} ms.`,
      resumen: `escribe y lee en ${segundos(tiempo)}`,
    };
  });

const chequeoAuth = (auth) =>
  seguro({ id: 'firebase_auth', area: 'Firebase', name: 'Inicio de sesión (Auth)' }, async () => {
    const inicio = Date.now();

    await auth.listUsers(1);
    const tiempo = ms(inicio);

    return {
      status:
        tiempo > UMBRALES_SALUD.firebaseLentoMs
          ? ESTADOS_SALUD.advertencia
          : ESTADOS_SALUD.correcto,
      value: `${tiempo} ms`,
      detail: `Firebase Auth responde en ${tiempo} ms.`,
      resumen: `responde en ${segundos(tiempo)}`,
    };
  });

const chequeoStorage = (bucket) =>
  seguro({ id: 'storage_uso', area: 'Firebase', name: 'Almacenamiento (Storage)' }, async () => {
    const [archivos] = await bucket.getFiles({ autoPaginate: true });
    const bytes = archivos.reduce(
      (total, archivo) => total + Number(archivo.metadata?.size || 0),
      0
    );
    const porcentaje = Math.round((bytes / LIMITE_STORAGE_BYTES) * 1000) / 10;

    return {
      status: estadoPorUmbral(
        porcentaje,
        UMBRALES_SALUD.storageAdvertencia,
        UMBRALES_SALUD.storageCritico
      ),
      value: `${porcentaje}%`,
      detail: `${archivos.length} archivos, ${megas(bytes)} de 5 GB (${porcentaje}%).`,
      resumen: `${archivos.length} archivos, ${megas(bytes)} (${String(porcentaje).replace('.', ',')} %)`,
      bytes,
      archivos: archivos.length,
    };
  });

// ---------------------------------------------------------------- API .NET

const chequeoServicioApi = (servicio, fetchImpl) =>
  seguro(
    { id: `api_${servicio.id}`, area: 'API .NET', name: `API de ${servicio.nombre}` },
    async () => {
      const inicio = Date.now();
      const control = new AbortController();
      const reloj = setTimeout(() => control.abort(), UMBRALES_SALUD.apiTiempoMaximoMs);

      try {
        const respuesta = await fetchImpl(`${API}${servicio.ruta}`, { signal: control.signal });
        // Se lee el cuerpo entero: una respuesta que corta a medias tampoco sirve.
        await respuesta.text();
        const tiempo = ms(inicio);

        if (!respuesta.ok) {
          return {
            status: ESTADOS_SALUD.critico,
            value: `HTTP ${respuesta.status}`,
            detail: `Respondió con error HTTP ${respuesta.status}.`,
            resumen: `error HTTP ${respuesta.status}`,
            tiempo,
          };
        }

        return {
          status:
            tiempo > UMBRALES_SALUD.apiLentaMs ? ESTADOS_SALUD.advertencia : ESTADOS_SALUD.correcto,
          value: `${tiempo} ms`,
          detail:
            tiempo > UMBRALES_SALUD.apiLentaMs
              ? `Responde, pero lenta: ${segundos(tiempo)}.`
              : `Responde en ${segundos(tiempo)}.`,
          resumen:
            tiempo > UMBRALES_SALUD.apiLentaMs
              ? `lenta, ${segundos(tiempo)}`
              : `responde en ${segundos(tiempo)}`,
          tiempo,
        };
      } catch (error) {
        if (error?.name === 'AbortError') {
          throw new Error(`sin respuesta tras ${UMBRALES_SALUD.apiTiempoMaximoMs / 1000} s`);
        }
        throw error;
      } finally {
        clearTimeout(reloj);
      }
    }
  );

/**
 * La API .NET, servicio por servicio, en un solo chequeo cuando todo va bien
 * ("7 de 7 responden") y uno por servicio cuando alguno falla.
 */
const chequeosApi = async (fetchImpl) => {
  // De dos en dos: la API es lenta y con todo a la vez tardaba más que en fila.
  const resultados = [];
  for (let i = 0; i < SERVICIOS_API.length; i += 2) {
    resultados.push(
      ...(await Promise.all(
        SERVICIOS_API.slice(i, i + 2).map((servicio) => chequeoServicioApi(servicio, fetchImpl))
      ))
    );
  }

  const mal = resultados.filter((r) => r.status !== ESTADOS_SALUD.correcto);

  if (mal.length) return resultados;

  const tiempos = resultados.map((r) => r.tiempo || 0);
  const peor = Math.max(...tiempos);

  return [
    chequeo({
      id: 'api_net',
      area: 'API .NET',
      name: 'API .NET (padrón)',
      status: ESTADOS_SALUD.correcto,
      value: `${resultados.length}/${resultados.length}`,
      detail: `Los ${resultados.length} servicios responden; el más lento en ${segundos(peor)}.`,
      resumen: `${resultados.length} de ${resultados.length} servicios responden (el más lento, ${segundos(peor)})`,
    }),
  ];
};

// ---------------------------------------------------------------- Datos

const contar = async (consulta) => (await consulta.count().get()).data().count || 0;

const chequeosColecciones = async (db) => {
  const resultados = await Promise.all(
    COLECCIONES_POR_MODULO.map((coleccion) =>
      seguro(
        { id: `coleccion_${coleccion.id}`, area: 'Módulos', name: coleccion.modulo },
        async () => {
          const total = await contar(db.collection(coleccion.id));
          const vacia = total === 0;

          return {
            status:
              vacia && coleccion.requerida
                ? ESTADOS_SALUD.critico
                : vacia
                  ? ESTADOS_SALUD.advertencia
                  : ESTADOS_SALUD.correcto,
            value: total,
            detail: vacia
              ? `La colección \`${coleccion.id}\` está vacía${coleccion.requerida ? ' y es necesaria' : ''}.`
              : `${total} registros en \`${coleccion.id}\`.`,
            resumen: vacia ? 'sin registros' : `${total} registros`,
          };
        }
      )
    )
  );
  const mal = resultados.filter((r) => r.status !== ESTADOS_SALUD.correcto);

  if (mal.length)
    return mal.concat(chequeoModulos(resultados.length - mal.length, resultados.length));

  return [chequeoModulos(resultados.length, resultados.length)];
};

const chequeoModulos = (bien, total) =>
  chequeo({
    id: 'modulos',
    area: 'Módulos',
    name: 'Módulos',
    status: ESTADOS_SALUD.correcto,
    value: `${bien}/${total}`,
    detail: `${bien} de ${total} módulos con datos.`,
    resumen: `${bien} de ${total} con datos`,
  });

const chequeoRespaldo = (db, ahora) =>
  seguro({ id: 'respaldo_reciente', area: 'Mantenimiento', name: 'Último respaldo' }, async () => {
    const respaldo = (await db.collection('respaldos_admin').doc('ultimo').get()).data();

    if (!respaldo?.fecha) {
      return {
        status: ESTADOS_SALUD.advertencia,
        value: 'Sin respaldo',
        detail: 'No hay ningún respaldo exportado desde Mantenimiento.',
        resumen: 'nunca se ha exportado uno',
      };
    }

    const dias = Math.floor((ahora.getTime() - new Date(respaldo.fecha).getTime()) / 86_400_000);

    return {
      status: estadoPorUmbral(
        dias,
        UMBRALES_SALUD.respaldoAdvertenciaDias,
        UMBRALES_SALUD.respaldoCriticoDias
      ),
      value: `${dias} días`,
      detail: `Último respaldo hace ${dias} días (${respaldo.archivo || 'sin nombre'}).`,
      resumen:
        dias >= UMBRALES_SALUD.respaldoAdvertenciaDias
          ? `hace ${dias} días; exporta uno en Mantenimiento`
          : `hace ${dias} ${dias === 1 ? 'día' : 'días'}`,
    };
  });

const chequeoNotificaciones = (db) =>
  seguro(
    { id: 'notificaciones_no_leidas', area: 'Notificaciones', name: 'Notificaciones pendientes' },
    async () => {
      const [pendientes, erroresSubida] = await Promise.all([
        contar(db.collection('notificaciones').where('estado', '==', 'no_leida')),
        contar(
          db
            .collection('notificaciones')
            .where('tipoNotificacion', '==', 'error_subida_archivo_imagen')
            .where('estado', '==', 'no_leida')
        ),
      ]);
      const estado = estadoPorUmbral(
        pendientes,
        UMBRALES_SALUD.notificacionesAdvertencia,
        UMBRALES_SALUD.notificacionesCritico
      );

      return {
        // Errores de subida sin revisar: por lo menos un aviso.
        status:
          erroresSubida && estado === ESTADOS_SALUD.correcto ? ESTADOS_SALUD.advertencia : estado,
        value: pendientes,
        detail: `${pendientes} sin leer${erroresSubida ? `, ${erroresSubida} de errores de subida` : ''}.`,
        resumen: `${pendientes} sin leer${erroresSubida ? `, ${erroresSubida} errores de subida` : ''}`,
      };
    }
  );

const chequeoAuditoria = (db, ahora) =>
  seguro({ id: 'auditoria_fallos', area: 'Auditoría', name: 'Auditoría (24 h)' }, async () => {
    const desde = new Date(ahora.getTime() - 86_400_000).toISOString();
    const recientes = await db
      .collection('auditoria_sistema')
      .where('fecha', '>=', desde)
      .orderBy('fecha', 'desc')
      .limit(500)
      .get();
    const registros = recientes.docs.map((d) => d.data());
    const fallos = registros.filter((r) => r.resultado && r.resultado !== 'exitoso');

    return {
      status: fallos.length ? ESTADOS_SALUD.advertencia : ESTADOS_SALUD.correcto,
      value: fallos.length,
      detail: fallos.length
        ? `${fallos.length} acciones fallidas en 24 h. La última: ${fallos[0].descripcion || fallos[0].accion || 'sin descripción'}.`
        : `${registros.length} acciones registradas en 24 h, ninguna fallida.`,
      resumen: fallos.length
        ? `${fallos.length} acciones fallidas`
        : `${registros.length} acciones, sin fallos`,
    };
  });

const chequeoConfiguracion = (env) =>
  seguro({ id: 'configuracion_servidor', area: 'Servidor', name: 'Configuración' }, async () => {
    // Solo el NOMBRE de lo que falta: nunca un valor.
    const faltan = [
      ['FIREBASE_SERVICE_ACCOUNT', 'cuenta de servicio'],
      ['TAREAS_PROGRAMADAS_SECRETO', 'secreto de las tareas diarias'],
      ['WEB_PUSH_VAPID_PRIVATE_KEY', 'notificaciones push'],
      ['WEB_PUSH_VAPID_SUBJECT', 'notificaciones push'],
    ].filter(([nombre]) => !env[nombre]);

    return {
      status: faltan.length ? ESTADOS_SALUD.advertencia : ESTADOS_SALUD.correcto,
      value: faltan.length ? `${faltan.length} faltan` : 'Completa',
      detail: faltan.length
        ? `Falta configurar: ${faltan.map(([n, para]) => `${n} (${para})`).join(', ')}.`
        : 'Secretos y claves del servidor configurados.',
      resumen: faltan.length
        ? `falta ${faltan.map(([, para]) => para).join(', ')}`
        : 'secretos y claves en su sitio',
    };
  });

/**
 * La revisión completa. Todo en paralelo menos la API .NET, que va de dos en dos.
 * Devuelve los chequeos en el orden en que se leen en el resumen.
 */
export async function revisarSaludDelSistema({
  db,
  auth,
  bucket,
  fetchImpl = fetch,
  env = process.env,
  ahora = new Date(),
}) {
  const [
    firestore,
    autenticacion,
    storage,
    api,
    modulos,
    respaldo,
    notificaciones,
    auditoria,
    configuracion,
  ] = await Promise.all([
    chequeoFirestore(db),
    chequeoAuth(auth),
    chequeoStorage(bucket),
    chequeosApi(fetchImpl),
    chequeosColecciones(db),
    chequeoRespaldo(db, ahora),
    chequeoNotificaciones(db),
    chequeoAuditoria(db, ahora),
    chequeoConfiguracion(env),
  ]);

  return [
    firestore,
    autenticacion,
    storage,
    ...api,
    ...modulos,
    respaldo,
    notificaciones,
    auditoria,
    configuracion,
  ];
}
