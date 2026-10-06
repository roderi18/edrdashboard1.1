import 'server-only';

import { UPSTREAM_KEYS, invalidateUpstream } from 'src/utils/upstream-cache';

import { COLECCIONES } from 'src/config/esquema-firestore.mjs';
import { crearCuentaSiFalta } from 'src/server/cuenta-de-miembro';
import { olvidarEstadoDeCuenta } from 'src/server/verificar-token';
import { buscarMiembroPorId } from 'src/server/miembros-directorio';
import { resolverRolesPorAsignaciones } from 'src/catalogs/directiva-roles';
import { puedeGestionarAMiembro } from 'src/server/alcance-gestion-miembros';
import { getAdminDb, getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';
import { ACCIONES_DE_SEGURIDAD, registrarEventoDeSeguridad } from 'src/server/auditoria-seguridad';
import {
  esCorreoInterno,
  correoInternoDe,
  buscarAccesoMiembro,
  identificarSolicitante,
} from 'src/server/claves-miembro';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// El correo de la ficha pasa a ser el de la cuenta.
//
// La cuenta de un miembro nace con un correo interno
// (`edr-10002@exploradores.app`) que no existe como buzon: mientras lo tenga, no
// se le puede enviar el enlace de recuperacion. En cuanto se le guarda un correo
// de verdad, la cuenta pasa a usarlo, y desde ese momento puede entrar y
// recuperar la clave con el. El acceso por numero sigue funcionando: la pantalla
// prueba los dos correos.
// ----------------------------------------------------------------------

const normalizarCorreo = (correo) =>
  String(correo ?? '')
    .trim()
    .toLowerCase();

const MIEMBROS_UPDATE_ENDPOINT =
  'https://systexploradores.somee.com/api/Miembros/UpdateMiembros';

// El correo de primer acceso debe quedar unido a la cuenta y a la ficha visible.
// Se reenvía el resto de la ficha tal como está para no borrar campos al actualizar
// únicamente el correo en el API externo.
const sincronizarCorreoEnFicha = async ({ idMiembros, correo, authorization }) => {
  const miembro = await buscarMiembroPorId(idMiembros);

  if (!miembro) {
    throw new Error('No encontramos la ficha del miembro para guardar el correo.');
  }

  const payload = {
    idMiembros: Number(miembro.idMiembros ?? miembro.id),
    codigoMiembro: miembro.codigoMiembro ?? miembro.memberId ?? null,
    nombres: miembro.nombres ?? miembro.firstName ?? null,
    apellidos: miembro.apellidos ?? miembro.lastName ?? null,
    genero: miembro.genero ?? miembro.gender ?? null,
    fechaNacimiento: miembro.fechaNacimiento ?? miembro.birthDate ?? null,
    sizeCamisas: miembro.sizeCamisas ?? null,
    ocupacion: miembro.ocupacion ?? null,
    fechaCreacion: miembro.fechaCreacion ?? null,
    idDestacamento: miembro.idDestacamento ?? miembro.destId ?? null,
    telefono: miembro.telefono ?? miembro.phoneNumber ?? null,
    direccion: miembro.direccion ?? miembro.memberAddress ?? null,
    correo,
    idDivision: miembro.idDivision ?? null,
    instructorCertificadoCi: miembro.instructorCertificadoCi ?? null,
    estatusVigenciaCi: miembro.estatusVigenciaCi ?? null,
    fechaInicioCertificado: miembro.fechaInicioCertificado ?? null,
    fechaFinCertificado: miembro.fechaFinCertificado ?? null,
  };

  const respuesta = await fetch(MIEMBROS_UPDATE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!respuesta.ok) {
    throw new Error(`No se pudo actualizar el correo en la ficha (${respuesta.status}).`);
  }

  invalidateUpstream(UPSTREAM_KEYS.miembros);
};

export async function POST(req) {
  try {
    if (!isAdminConfigured()) {
      return Response.json(
        { error: 'El servidor no puede actualizar cuentas ahora mismo.' },
        { status: 503 }
      );
    }

    const { idMiembros, codigoMiembro, correo } = await req.json();
    const correoNuevo = normalizarCorreo(correo);

    if (!idMiembros && !codigoMiembro) {
      return Response.json({ error: 'Falta identificar al miembro.' }, { status: 400 });
    }

    if (!correoNuevo || esCorreoInterno(correoNuevo)) {
      return Response.json({ error: 'Ese correo no sirve para iniciar sesión.' }, { status: 400 });
    }

    // Quien pide y de quien es la cuenta, a la vez: no se necesitan entre si y
    // en serie era el doble de espera. No se escribe nada hasta comprobar el
    // permiso, unas lineas mas abajo.
    const [solicitante, encontrado] = await Promise.all([
      // Con gracia de primer acceso: el miembro que acaba de elegir contraseña
      // guarda aqui su correo con el mismo token (ver `verificar-token-core.mjs`).
      identificarSolicitante(req, { graciaPrimerAcceso: true }),
      buscarAccesoMiembro({ idMiembros, codigoMiembro }),
    ]);

    if (!solicitante) {
      return Response.json({ error: 'Vuelve a entrar e inténtalo de nuevo.' }, { status: 401 });
    }

    let { cuenta, perfil } = encontrado;

    // TODO MIEMBRO TIENE CUENTA: si este llegó al padrón sin ella, se le crea
    // ahora, con sus datos del padrón y solo si quien pide puede gestionarlo.
    if (!cuenta) {
      ({ cuenta, perfil } =
        (await crearCuentaSiFalta({ solicitante, idMiembros, codigoMiembro })) ?? {});

      // `crearCuentaSiFalta` solo devuelve algo si la CREO: queda constancia.
      if (cuenta) {
        await registrarEventoDeSeguridad(req, {
          accion: ACCIONES_DE_SEGURIDAD.cuentaCreada,
          actor: solicitante,
          objetivo: { uid: cuenta.uid, idMiembros, codigoMiembro },
          detalle: { origen: 'correo_de_acceso' },
        });
      }
    }

    if (!cuenta) {
      return Response.json(
        { error: 'Ese miembro todavía no tiene cuenta de acceso.' },
        { status: 404 }
      );
    }

    // Cada quien puede cambiar el suyo. Para el de otro no basta el permiso de
    // editar miembros: el correo de acceso es con lo que se recupera la clave,
    // asi que poner el propio en la ficha de otro es quedarse con su cuenta a un
    // "olvidé mi contraseña" de distancia. Tiene que ser alguien de su cadena de
    // mando y por encima de el.
    if (cuenta.uid !== solicitante.uid) {
      const { permitido, motivo } = await puedeGestionarAMiembro({
        solicitante,
        idMiembros: idMiembros ?? perfil?.data()?.idMiembros,
        uidObjetivo: cuenta.uid,
        resolverRoles: resolverRolesPorAsignaciones,
      });

      if (!permitido) {
        await registrarEventoDeSeguridad(req, {
          accion: ACCIONES_DE_SEGURIDAD.correoDenegado,
          resultado: 'denegado',
          actor: solicitante,
          objetivo: { uid: cuenta.uid, idMiembros, codigoMiembro },
          detalle: { motivo, correoPedido: correoNuevo },
        });

        return Response.json(
          { error: 'Tu rol no puede cambiar el correo de acceso de ese miembro.' },
          { status: 403 }
        );
      }
    }

    // CAMBIAR EL CORREO ES ENTREGAR LA CUENTA: con el se recupera la clave. Para la
    // propia hace falta una sesion reciente —una robada hace dias no basta— salvo
    // en el primer acceso, que es justo cuando se registra por primera vez.
    if (
      cuenta.uid === solicitante.uid &&
      !solicitante.debeCambiarClave &&
      Date.now() / 1000 - solicitante.authTime > 30 * 60
    ) {
      await registrarEventoDeSeguridad(req, {
        accion: ACCIONES_DE_SEGURIDAD.correoDenegado,
        resultado: 'denegado',
        actor: solicitante,
        objetivo: { uid: cuenta.uid },
        detalle: { motivo: 'sesion_no_reciente', correoPedido: correoNuevo },
      });

      return Response.json(
        { error: 'Por seguridad, vuelve a iniciar sesión para cambiar tu correo de acceso.' },
        { status: 403 }
      );
    }

    if (normalizarCorreo(cuenta.email) === correoNuevo) {
      await sincronizarCorreoEnFicha({
        idMiembros: idMiembros ?? perfil?.data()?.idMiembros,
        correo: correoNuevo,
        authorization: req.headers.get('authorization') || '',
      });
      return Response.json({ ok: true, sinCambios: true });
    }

    try {
      await getAdminAuth().updateUser(cuenta.uid, { email: correoNuevo, emailVerified: false });
    } catch (error) {
      if (error?.code === 'auth/email-already-exists') {
        return Response.json(
          { error: 'Ese correo ya lo usa otra cuenta de la aplicación.' },
          { status: 409 }
        );
      }

      throw error;
    }

    // El correo de OTRA persona cambio por decision de su cadena de mando: las
    // sesiones abiertas de esa cuenta se cierran (quien las tuviera robadas se
    // queda fuera). La propia sesion de quien lo cambia no se toca.
    if (cuenta.uid !== solicitante.uid) {
      await getAdminAuth()
        .revokeRefreshTokens(cuenta.uid)
        .catch((error) =>
          console.error('[correo-cuenta-miembro] no se pudieron cerrar las sesiones', error)
        );
      olvidarEstadoDeCuenta(cuenta.uid);
    }

    // CAMBIAR EL CORREO ES ENTREGAR LA CUENTA: de cual a cual y quien lo hizo. Se
    // registra aqui, justo despues de cambiarlo en Firebase, porque lo que sigue
    // (perfil y ficha) puede fallar y el cambio ya esta hecho.
    await registrarEventoDeSeguridad(req, {
      accion: ACCIONES_DE_SEGURIDAD.correoCambiado,
      actor: solicitante,
      objetivo: { uid: cuenta.uid, idMiembros, codigoMiembro },
      detalle: {
        anterior: normalizarCorreo(cuenta.email),
        nuevo: correoNuevo,
        propio: cuenta.uid === solicitante.uid,
        primerAcceso: solicitante.debeCambiarClave === true,
        sesionesCerradas: cuenta.uid !== solicitante.uid,
      },
    });

    const db = getAdminDb();
    // El perfil ya viene de la busqueda de la cuenta: pedirlo otra vez era otro
    // viaje a Firestore para traer lo mismo.
    const referencia =
      perfil?.ref ?? db.collection(COLECCIONES.usuariosRoles).doc(String(idMiembros || cuenta.uid));

    const datosPerfil = perfil?.data() ?? {};

    await Promise.all([
      // Con el uid dentro: al dejar de existir el correo interno, es lo unico
      // que permite volver a encontrar la cuenta.
      referencia.set(
        { correo: correoNuevo, correoPersonal: correoNuevo, uid: cuenta.uid },
        { merge: true }
      ),
      db.collection(COLECCIONES.usuarios).doc(cuenta.uid).set({ email: correoNuevo }, { merge: true }),
      // Tambien bajo el uid: al dejar de ser un correo `@exploradores.app`, la
      // sesion ya no puede reconocerlo como miembro por el correo y lo busca por
      // el uid. Sin este documento entraria sin su perfil.
      db
        .collection(COLECCIONES.usuariosRoles)
        .doc(cuenta.uid)
        .set(
          {
            ...datosPerfil,
            uid: cuenta.uid,
            idMiembros: Number(idMiembros ?? datosPerfil.idMiembros) || datosPerfil.idMiembros || null,
            codigoMiembro: codigoMiembro || datosPerfil.codigoMiembro || '',
            correo: correoNuevo,
            correoPersonal: correoNuevo,
          },
          { merge: true }
        ),
    ]);

    await sincronizarCorreoEnFicha({
      idMiembros: idMiembros ?? perfil?.data()?.idMiembros,
      correo: correoNuevo,
      authorization: req.headers.get('authorization') || '',
    });

    return Response.json({
      ok: true,
      // Con que correo entraba antes, para poder decirselo a quien lo cambio.
      correoAnterior: esCorreoInterno(cuenta.email)
        ? correoInternoDe(codigoMiembro || '')
        : normalizarCorreo(cuenta.email),
    });
  } catch (error) {
    console.error('[correo-cuenta-miembro] no se pudo actualizar', error);

    return Response.json({ error: 'No pudimos actualizar el correo de acceso.' }, { status: 500 });
  }
}
