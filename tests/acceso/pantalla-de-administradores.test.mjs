import fs from 'node:fs';
import test from 'node:test';
import { register } from 'node:module';
import assert from 'node:assert/strict';

// El codigo REAL, no una replica: ver `tests/soporte/resolver-alias-src.mjs`.
register(new URL('../soporte/resolver-alias-src.mjs', import.meta.url));

const { ROLES_DE_ADMINISTRACION, esPerfilDeAdministracion, ADMIN_ROLE_IDS } =
  await import('src/utils/admin-role-label.js');

const leer = (relativa) => fs.readFileSync(relativa, 'utf8');

// ----------------------------------------------------------------------
// EN "ADMINISTRADORES" SALEN LOS ADMINISTRADORES, Y NADIE MAS.
//
// `/dashboard/admin` listaba a cualquiera que estuviera en ADMIN_ROLE_IDS, que no
// es la lista de quien administra la plataforma sino la de que cargos construyen
// una SESION de administrador: casi todo el catalogo. El resultado era una lista
// de "Administradores" con decenas de Coordinadores de Destacamento, de seccion y
// de region. Y la Oficina Nacional, que si gobierna, no aparecia porque no estaba
// en aquella lista.
//
// Son cuatro cargos, y son los unicos que se reparten desde esa pantalla. Los
// organizacionales se ponen en la ficha del miembro y en las directivas.
// ----------------------------------------------------------------------

test('la administracion de la plataforma son exactamente cuatro cargos', () => {
  assert.deepEqual(ROLES_DE_ADMINISTRACION, [
    'administrador_global',
    'administrador_funcional',
    'administrador_tienda',
    'oficina_nacional',
  ]);
});

test('la lista de sesion admin NO se toca: es otra pregunta', () => {
  // ADMIN_ROLE_IDS decide quien entra al panel con su alcance. Si se recortara a
  // los cuatro, un Coordinador Seccional dejaria de tener sesion de administrador
  // y perderia su panel entero.
  ['usuario_destacamento', 'usuario_seccion', 'usuario_region'].forEach((codigo) => {
    assert.ok(ADMIN_ROLE_IDS.includes(codigo), `${codigo} conserva su sesion de administrador`);
    assert.ok(
      !ROLES_DE_ADMINISTRACION.includes(codigo),
      `${codigo} no sale en la lista de administradores`
    );
  });
});

test('los cuatro cargos de administracion pasan el colador', () => {
  ROLES_DE_ADMINISTRACION.forEach((codigo) => {
    assert.equal(esPerfilDeAdministracion({ rolId: codigo }), true, codigo);
    assert.equal(esPerfilDeAdministracion({ roleId: codigo }), true, `${codigo} por roleId`);
  });
});

test('los cargos organizacionales no pasan, aunque tengan documento antiguo', () => {
  [
    'usuario_destacamento',
    'pastor_destacamento',
    'lider_grupo',
    'usuario_seccion',
    'capellan_seccional',
    'zonas',
    'usuario_region',
    'secretario_regional',
    'director_nacional',
    'consejo_ejecutivo',
    'usuario_comun',
  ].forEach((codigo) => {
    assert.equal(esPerfilDeAdministracion({ rolId: codigo }), false, codigo);
    // Con el campo heredado ademas: el codigo de cargo MANDA. Un documento viejo
    // marcado como 'administrador' no convierte en administrador a quien hoy tiene
    // un cargo de seccion.
    assert.equal(
      esPerfilDeAdministracion({ rolId: codigo, rol: 'administrador' }),
      false,
      `${codigo} con rol heredado`
    );
  });
});

test('una cuenta de administrador anterior al catalogo no se pierde', () => {
  // Sin codigo de cargo, el campo heredado es lo unico que hay.
  assert.equal(esPerfilDeAdministracion({ rol: 'administrador' }), true);
  assert.equal(esPerfilDeAdministracion({ rol: 'admin' }), true);
  assert.equal(esPerfilDeAdministracion({ role: 'ADMIN' }), true);
});

test('un perfil sin nada no es administrador', () => {
  assert.equal(esPerfilDeAdministracion({}), false);
  assert.equal(esPerfilDeAdministracion({ rol: 'miembro' }), false);
  assert.equal(esPerfilDeAdministracion(), false);
});

// ----------------------------------------------------------------------
// Donde se aplica.
// ----------------------------------------------------------------------

test('la consulta pregunta por los cuatro cargos y cuela el resultado', () => {
  const fuente = leer('src/utils/firebase-admins.js');

  assert.match(fuente, /getDocsByFieldIn\('usuarios_roles', 'rolId', ROLES_DE_ADMINISTRACION\)/);
  assert.match(fuente, /getDocsByFieldIn\('usuarios_roles', 'roleId', ROLES_DE_ADMINISTRACION\)/);
  // El colador final hace falta: de las cinco fuentes, tres no preguntan por el
  // cargo y traerian a cualquiera con un documento antiguo.
  assert.match(fuente, /\.filter\(esPerfilDeAdministracion\)/);
});

test('el desplegable de la pantalla ofrece solo esos cuatro', () => {
  const dialogo = leer('src/sections/admin/admin-role-assignment-dialog.jsx');

  assert.match(
    dialogo,
    /const assignableRoles = useMemo\(\s*\(\) =>\s*ROLES_DE_ADMINISTRACION\.map/
  );
  // Y los cuatro salen siempre, aunque la coleccion de autorizacion no los traiga.
  assert.match(dialogo, /LOCAL_ROLES\.find\(\(role\) => role\.codigo === codigo\)/);
  assert.doesNotMatch(
    dialogo,
    /roles\.filter\(\(role\) => role\.codigo !== 'administrador_global'\)/
  );
});

test('a la Oficina Nacional no se le pide una entidad: su alcance es el pais', () => {
  const dialogo = leer('src/sections/admin/admin-role-assignment-dialog.jsx');

  assert.match(dialogo, /'administrador_tienda', 'oficina_nacional'/);
});

// ----------------------------------------------------------------------
// Las dos pantallas ensenan lo mismo.
// ----------------------------------------------------------------------

test('la lista y la pantalla de crear usan las MISMAS columnas', () => {
  const lista = leer('src/sections/admin/view/admin-list-view.jsx');
  const crear = leer('src/sections/admin/view/admin-create-view.jsx');

  // Ninguna define las suyas: salian distintas porque se cambiaba una y la otra
  // se quedaba con las de antes.
  [lista, crear].forEach((vista) => {
    assert.doesNotMatch(vista, /const TABLE_HEAD = \[/);
    assert.match(vista, /headCells=\{COLUMNAS_DE_ADMINISTRADORES\}/);
    assert.match(vista, /useDatosDeAdministradores\(\)/);
  });
});

test('las columnas son las cuatro acordadas, sin Estado', () => {
  const gancho = leer('src/sections/admin/use-datos-de-administradores.js');
  const etiquetas = [...gancho.matchAll(/label: '([^']+)'/g)].map(
    (coincidencia) => coincidencia[1]
  );

  assert.deepEqual(etiquetas, [
    'Nombre',
    'Nivel organizacional',
    'Roles organizacionales',
    'Rol administrativo',
  ]);

  const fila = leer('src/sections/admin/admin-table-row.jsx');
  assert.doesNotMatch(fila, /row\.estatus/);
});

test('al nombrar se elige el cargo, no se confirma un si', () => {
  const crear = leer('src/sections/admin/view/admin-create-view.jsx');
  const dialogo = leer('src/sections/admin/admin-asignar-cargo-dialog.jsx');

  assert.match(crear, /<AdminAsignarCargoDialog/);
  assert.match(crear, /rolDeAdministracion: rolElegido/);
  // El desplegable sale de la misma lista de cuatro.
  assert.match(dialogo, /ROLES_DE_ADMINISTRACION\.map/);
  // Y abre en el de MENOS poder: abrir en Administrador Global convertia un
  // despiste en la llave de todo.
  assert.match(dialogo, /const POR_DEFECTO = 'administrador_tienda';/);
});

test('el cambio de cargo avisa a la persona, no solo a los otros administradores', () => {
  const aviso = leer('src/utils/notificar-cargo-administracion.js');

  assert.match(aviso, /idsDestinatarios: \[destinatario\]/);
  // Y no tumba el cambio si falla: el cargo ya esta guardado cuando esto corre.
  assert.match(aviso, /catch \(error\)/);

  // Los dos caminos que cambian un cargo avisan.
  assert.match(leer('src/utils/firebase-admins.js'), /await notificarCargoDeAdministracion\(\{/);
  assert.match(
    leer('src/auth/permissions/firebase-permissions.js'),
    /await notificarCargoDeAdministracion\(\{/
  );
});

test('los cargos salen de las directivas, no de la copia de la sesion', () => {
  const gancho = leer('src/sections/admin/use-datos-de-administradores.js');

  // `usuarios_roles` guarda una COPIA de los cargos que escribe la sincronizacion
  // de la sesion, y esa copia no siempre existe: a la cuenta del selector de rol
  // no se le escribe nunca, y a quien no ha vuelto a entrar desde que le dieron la
  // casilla tampoco. La columna salia "-" para gente que si tiene cargo.
  assert.match(gancho, /obtenerAsignacionesDirectivaMiembros\(\)/);
  assert.match(gancho, /resolverRolesPorAsignaciones\(suyas\)/);
  assert.doesNotMatch(gancho, /collection\(FIRESTORE, 'usuarios_roles'\)/);
});

test('la columna no repite los cargos de administracion', () => {
  const util = leer('src/utils/ubicacion-organizacional.js');

  // Tienen su propia columna; repetirlos hacia leer dos veces lo mismo.
  assert.match(util, /if \(ROLES_DE_ADMINISTRACION\.includes\(codigo\)\) return;/);
});
