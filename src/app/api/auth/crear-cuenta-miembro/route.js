import 'server-only';

import { limiteSuperado } from 'src/server/limite-intentos';
import { isAdminConfigured } from 'src/server/firebase-admin';
import { CuentaYaExiste, crearCuentaDeMiembro } from 'src/server/cuenta-de-miembro';
import { normalizarCodigo, identificarSolicitante } from 'src/server/claves-miembro';
import { ACCIONES_DE_SEGURIDAD, registrarEventoDeSeguridad } from 'src/server/auditoria-seguridad';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// La cuenta de acceso de un miembro nuevo.
//
// ANTES la creaba el navegador y la contraseña inicial era el codigo del miembro
// en mayusculas (`EDR-10002`). Como los codigos son correlativos, cualquiera
// podia recorrer `EDR-10001`, `EDR-10002`... y entrar como todo el que aun no
// hubiera cambiado la suya. Y una vez dentro no estaba encerrado en "Crea tu
// contraseña" —ese guarda es de navegador—: podia fijar el la definitiva y
// dejar fuera al miembro de verdad.
//
// Ahora la contraseña inicial es aleatoria y NO SE DEVUELVE: no la ve ni quien
// crea al miembro. Para entrar la primera vez, su coordinador le genera un
// codigo de un solo uso desde su ficha, igual que para cualquier recuperacion.
// ----------------------------------------------------------------------


export async function POST(req) {
  try {
    if (!isAdminConfigured()) {
      return Response.json(
        { error: 'El servidor no puede crear cuentas ahora mismo.' },
        { status: 503 }
      );
    }

    const frenado = limiteSuperado(req, {
      grupo: 'crear-cuenta',
      maximo: 60,
      ventanaMs: 60 * 1000,
    });

    if (frenado) return frenado;

    const solicitante = await identificarSolicitante(req);

    if (!solicitante) {
      return Response.json({ error: 'Vuelve a entrar e inténtalo de nuevo.' }, { status: 401 });
    }

    if (!solicitante.puedeCrearMiembros) {
      await registrarEventoDeSeguridad(req, {
        accion: ACCIONES_DE_SEGURIDAD.accesoDenegado,
        resultado: 'denegado',
        actor: solicitante,
        detalle: { motivo: 'sin_permiso_crear_cuentas' },
      });

      return Response.json({ error: 'Tu rol no puede crear cuentas de acceso.' }, { status: 403 });
    }

    const { codigoMiembro, firstName, lastName, destId, memberId } = await req.json();
    const username = normalizarCodigo(codigoMiembro);

    if (!username) {
      return Response.json(
        { error: 'No se puede crear la cuenta sin código de miembro.' },
        { status: 400 }
      );
    }

    let creada;

    try {
      // La crea la pieza compartida con "Restablecer contraseña" (ver el archivo).
      creada = await crearCuentaDeMiembro({ codigoMiembro, firstName, lastName, destId, memberId });
    } catch (error) {
      if (error instanceof CuentaYaExiste) {
        return Response.json(
          { error: 'Ese miembro ya tiene cuenta de acceso.', yaExistia: true },
          { status: 409 }
        );
      }

      throw error;
    }

    await registrarEventoDeSeguridad(req, {
      accion: ACCIONES_DE_SEGURIDAD.cuentaCreada,
      actor: solicitante,
      objetivo: { uid: creada.cuenta.uid, idMiembros: memberId, codigoMiembro },
      detalle: { origen: 'alta_de_miembro', destacamento: destId ?? null },
    });

    // La contraseña NO sale de aqui, a proposito.
    return Response.json({
      uid: creada.cuenta.uid,
      emailFake: creada.correo,
      username: creada.username,
    });
  } catch (error) {
    console.error('[crear-cuenta-miembro] no se pudo crear', error);

    return Response.json({ error: 'No pudimos crear la cuenta de acceso.' }, { status: 500 });
  }
}
