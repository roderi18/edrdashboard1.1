import 'server-only';

import { claimsConservandoClave } from 'src/server/claims-con-marca-de-clave-core.mjs';

// ----------------------------------------------------------------------
// LOS CLAIMS SE REEMPLAZAN ENTEROS. Quien los reescribe por el cargo (al entrar,
// al asignar un rol, al sincronizar) mandaba solo rol, alcance e id de miembro, y
// con eso BORRABA `debeCambiarClave`. Pasó con EDR-10049, Coordinador de
// Destacamento: entró con el código de un solo uso, la sincronización del cargo
// le quitó la marca del token a los dos segundos y la pantalla de "Crea tu
// contraseña" —que se fía del token— le dejó pasar al panel sin elegir ninguna.
//
// La marca solo la retira `/api/auth/clave-miembro` (o `marcarDebeCambiarClave`
// con false) cuando guarda su contraseña. Todo lo demás la conserva.
// ----------------------------------------------------------------------

export async function fijarClaimsConservandoClave(auth, uid, claims = {}) {
  const actuales = (await auth.getUser(String(uid)).catch(() => null))?.customClaims ?? {};
  const finales = claimsConservandoClave(actuales, claims);

  await auth.setCustomUserClaims(String(uid), finales);

  return finales;
}
