import 'server-only';

import { getAdminAuth, isAdminConfigured } from 'src/server/firebase-admin';

// ----------------------------------------------------------------------
// ¿Le puede llegar a un miembro el enlace de recuperacion a ese correo?
//
// El enlace de Firebase cambia la clave de LA CUENTA QUE TENGA ESE CORREO. Se
// enviaba al correo personal de la ficha del miembro, que casi nunca es el de su
// cuenta —la cuenta usa `<codigo>@exploradores.app`—, asi que si ese correo era
// el de otra persona registrada, el enlace le cambiaba la clave A ESA OTRA
// CUENTA. Le paso al administrador: pidio recuperar la de un miembro y termino
// cambiando la suya.
//
// Aqui se compara, con el Admin SDK, el correo propuesto con el REAL de la
// cuenta del miembro. No se devuelve ningun correo entero: solo si coinciden.
// ----------------------------------------------------------------------

const DOMINIO_INTERNO = 'exploradores.app';

const normalizarCodigo = (codigo) =>
  String(codigo ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');

const normalizarCorreo = (correo) => String(correo ?? '').trim().toLowerCase();

export async function POST(req) {
  try {
    if (!isAdminConfigured()) {
      return Response.json(
        { error: 'El servidor no puede comprobar las cuentas ahora mismo.' },
        { status: 503 }
      );
    }

    const { codigo, correo } = await req.json();
    const usuario = normalizarCodigo(codigo);

    if (!usuario) {
      return Response.json({ error: 'Falta el código de miembro.' }, { status: 400 });
    }

    const auth = getAdminAuth();
    const cuenta = await auth.getUserByEmail(`${usuario}@${DOMINIO_INTERNO}`).catch(() => null);

    // Sin cuenta no hay nada que restablecer. La respuesta es la misma que la de
    // "existe pero no tiene correo propio": quien pregunta no tiene por que
    // saber quien esta dado de alta.
    if (!cuenta) {
      return Response.json({ coincide: false, tieneCorreoPropio: false });
    }

    const correoCuenta = normalizarCorreo(cuenta.email);
    const tieneCorreoPropio = Boolean(correoCuenta) && !correoCuenta.endsWith(`@${DOMINIO_INTERNO}`);

    return Response.json({
      tieneCorreoPropio,
      coincide: tieneCorreoPropio && correoCuenta === normalizarCorreo(correo),
    });
  } catch (error) {
    console.error('[correo-recuperacion] fallo la comprobacion', error);

    return Response.json({ error: 'No se pudo comprobar el correo.' }, { status: 500 });
  }
}
