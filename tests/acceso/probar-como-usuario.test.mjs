import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const leer = (ruta) => readFile(new URL(`../../${ruta}`, import.meta.url), 'utf8');

test('el acceso como otro usuario queda restringido al Administrador Global autorizado', async () => {
  const ruta = await leer('src/app/api/admin/probar-como-usuario/route.js');

  assert.match(ruta, /puedeUsarSelectorDeRol\(decodificado\.email\)/);
  assert.match(ruta, /perfilGlobalActivo/);
  // Desde 9855dad8 hay dos cuentas autorizadas (`ADMIN_ROLE_SWITCH_EMAILS`); el
  // servidor lo repite con el correo del token y exige el perfil global activo.
  assert.match(ruta, /Solo las cuentas Administrador Global autorizadas pueden usar esta función\./);
});

test('emite la sesión real del miembro sin tocar sus credenciales', async () => {
  const ruta = await leer('src/app/api/admin/probar-como-usuario/route.js');

  assert.match(ruta, /createCustomToken\(objetivo\.cuenta\.uid\)/);
  assert.doesNotMatch(ruta, /RESEND_API_KEY|codigoAprobacion/);
});

test('no cambia contraseñas, roles ni permisos', async () => {
  const ruta = await leer('src/app/api/admin/probar-como-usuario/route.js');

  assert.doesNotMatch(ruta, /updatePassword|setCustomUserClaims|updateUser/);
});

test('la interfaz conserva una salida visible hacia la cuenta original', async () => {
  const banner = await leer('src/layouts/components/sesion-como-usuario-banner.jsx');
  const dialogo = await leer('src/layouts/components/probar-como-usuario-dialog.jsx');
  const layout = await leer('src/layouts/dashboard/layout.jsx');

  assert.match(banner, /Volver a mi cuenta/);
  assert.match(banner, /baseURL: window\.location\.origin/);
  assert.match(dialogo, /baseURL: window\.location\.origin/);
  assert.match(layout, /SesionComoUsuarioBanner/);
});

// Las dos cuentas autorizadas fallaban: `admins` de rdpr18 estaba vacío y el de
// rodery123456 decía 'administrador' (se exigía 'admin'). Ahora manda el cargo
// de `usuarios_roles`, y el espejo de `admins` queda de respaldo.
test('el Administrador Global se reconoce por usuarios_roles, no solo por admins', async () => {
  const ruta = await leer('src/app/api/admin/probar-como-usuario/route.js');

  assert.match(ruta, /db\.collection\('usuarios_roles'\)\.doc\(uid\)\.get\(\)/);
  assert.match(ruta, /\['administrador_global', 'admin', 'administrador'\]/);
  // Sigue haciendo falta estar en la lista de correos autorizados.
  assert.match(ruta, /puedeUsarSelectorDeRol\(cuenta\.email\)/);
});
