import 'server-only';

import { limiteSuperado } from 'src/server/limite-intentos';
import { isAdminConfigured } from 'src/server/firebase-admin';
import { buscarCuentaMiembro } from 'src/server/claves-miembro';
import { datosMinimosDeMiembro, buscarMiembroPorNumero } from 'src/server/miembros-directorio';

export const runtime = 'nodejs';

// ----------------------------------------------------------------------
// Con que correo entra este miembro.
//
// La cuenta nace con un correo interno (`edr-10002@exploradores.app`) y pasa al
// personal en cuanto registra uno. Desde el navegador no hay forma de saber cual
// de los dos tiene, y probar el equivocado gasta un intento fallido contra
// Firebase —que acaba bloqueando por exceso de intentos— y hace que el acceso
// parezca fallar la primera vez.
//
// La pantalla manda SOLO el numero que se acaba de teclear. Antes se descargaba
// el padron entero en el navegador para averiguar el codigo y el correo de la
// ficha, y por eso `/api/members/` tenia que estar abierta a cualquiera; ahora
// esa busqueda pasa aqui y de vuelta va unicamente el correo con el que se
// inicia sesion, que es lo unico que el formulario necesita.
// ----------------------------------------------------------------------

export async function POST(req) {
  try {
    if (!isAdminConfigured()) return Response.json({ correo: '' });

    // Va sin sesion por necesidad —quien entra todavia no la tiene—, asi que es
    // una puerta abierta a recorrer numeros cosechando correos. El limite es lo
    // unico que la separa de eso.
    const frenado = limiteSuperado(req, { grupo: 'correo-acceso', maximo: 15, ventanaMs: 60 * 1000 });

    if (frenado) return frenado;

    const { numeroUsuario, idMiembros, codigoMiembro, correo } = await req.json();

    // Por numero: es lo que teclea el miembro y lo unico que se acepta desde una
    // pantalla sin sesion. El resto de los datos siguen valiendo para quien ya
    // los tiene (la ficha del miembro, con sesion abierta).
    const ficha = numeroUsuario ? await buscarMiembroPorNumero(numeroUsuario) : null;
    const datos = ficha ? datosMinimosDeMiembro(ficha) : null;

    // Un numero que no existe se responde IGUAL que uno que si pero cuya cuenta
    // no se pudo resolver: correo vacio y 200. Contestar 400 solo a los que no
    // existen es un buscador de miembros dados de alta.
    if (numeroUsuario && !datos) return Response.json({ correo: '' });

    if (!datos && !idMiembros && !codigoMiembro) {
      return Response.json({ error: 'Falta identificar al miembro.' }, { status: 400 });
    }

    const cuenta = await buscarCuentaMiembro({
      idMiembros: datos?.idMiembros ?? idMiembros,
      codigoMiembro: datos?.codigoMiembro || codigoMiembro,
      correo: datos?.correo || correo,
    });

    return Response.json({ correo: cuenta?.email || '' });
  } catch (error) {
    console.error('[correo-acceso] no se pudo resolver', error);

    // Sin respuesta, la pantalla prueba los correos que conoce.
    return Response.json({ correo: '' });
  }
}
