// ----------------------------------------------------------------------
// LA CUENTA DE ACCESO DE VERDAD de la persona a la que se le da un cargo.
//
// La pantalla de Administradores lista a las personas desde el padron y manda
// su identificador tal como lo tiene: a veces el uid de Firebase, a veces su
// NUMERO de miembro (`326`). El cargo se escribia en `usuarios_roles/<ese id>`.
//
// Pero la sesion, las reglas de Firestore y la sincronizacion de cargos leen
// `usuarios_roles/<uid de Firebase>`. Con el numero, el cargo quedaba guardado
// en un documento que nadie mira: la pantalla decia "Administrador de Gestion de
// Tienda" y la persona entraba sin un solo permiso de la tienda. Pasaba igual con
// los cuatro cargos de administracion (Global, Funcional, Tienda y Oficina
// Nacional), porque todos van por la misma ruta.
//
// Aqui se averigua a que cuentas de Firebase corresponde esa persona, por todos
// los caminos que la identifican: el propio id si ya es un uid, los uid que
// guarden sus documentos, los documentos con su numero o su codigo de miembro, el
// correo interno de su codigo (`edr-10002@exploradores.app`) y su correo.
//
// Es logica pura con las dependencias inyectadas, para probarla sin Firebase.
// ----------------------------------------------------------------------

const DOMINIO_DE_MIEMBROS = 'exploradores.app';

const texto = (valor) => String(valor ?? '').trim();

const correoInternoDeCodigo = (codigo) => {
  const limpio = texto(codigo).toLowerCase();

  return /^edr-\d+$/.test(limpio) ? `${limpio}@${DOMINIO_DE_MIEMBROS}` : '';
};

/**
 * @param {object} datos
 * @param {string} datos.idObjetivo  Lo que manda la pantalla: uid o numero de miembro.
 * @param {string} [datos.correo]    El correo que se conozca de la persona.
 * @param {(uid: string) => Promise<{uid: string}>} datos.obtenerUsuario       `auth.getUser`.
 * @param {(correo: string) => Promise<{uid: string}>} datos.obtenerPorCorreo  `auth.getUserByEmail`.
 * @param {(id: string) => Promise<object|null>} datos.leerRol                  `usuarios_roles/<id>`.
 * @param {(campo: string, valor: any) => Promise<Array<{id: string, data: object}>>} datos.buscarPerfiles
 *   Documentos de `usuarios_roles` y `users` con ese campo igual a ese valor.
 * @returns {Promise<{ uids: string[], idMiembros: string, codigoMiembro: string }>}
 */
export const resolverCuentasDelObjetivo = async ({
  idObjetivo,
  correo = '',
  obtenerUsuario,
  obtenerPorCorreo,
  leerRol,
  buscarPerfiles,
}) => {
  const uids = new Set();
  const intentados = new Set();

  const probarUid = async (candidato) => {
    const uid = texto(candidato);

    if (!uid || intentados.has(uid)) return;

    intentados.add(uid);

    const registro = await obtenerUsuario(uid).catch(() => null);

    if (registro?.uid) uids.add(registro.uid);
  };

  const probarCorreo = async (candidato) => {
    const valor = texto(candidato).toLowerCase();

    if (!valor || !valor.includes('@')) return;

    const registro = await obtenerPorCorreo(valor).catch(() => null);

    if (registro?.uid) uids.add(registro.uid);
  };

  const id = texto(idObjetivo);

  await probarUid(id);

  const documento = (await leerRol(id).catch(() => null)) ?? {};
  const idMiembros = texto(
    documento.idMiembros ?? documento.memberId ?? (/^\d+$/.test(id) ? id : '')
  );
  const codigoMiembro = texto(documento.codigoMiembro ?? documento.codigoUsuario);

  await Promise.all(
    [documento.uid, documento.uidUsuario, documento.idUsuario].map((candidato) =>
      probarUid(candidato)
    )
  );

  // Los documentos que comparten su numero o su codigo: el de su uid esta ahi.
  const busquedas = [
    ...(idMiembros
      ? [buscarPerfiles('idMiembros', idMiembros), buscarPerfiles('idMiembros', Number(idMiembros))]
      : []),
    ...(codigoMiembro ? [buscarPerfiles('codigoMiembro', codigoMiembro)] : []),
  ];
  const perfiles = (
    await Promise.all(busquedas.map((busqueda) => busqueda.catch(() => [])))
  ).flat();

  await Promise.all(
    perfiles.flatMap((perfil) => [
      probarUid(perfil?.id),
      probarUid(perfil?.data?.uid),
      probarUid(perfil?.data?.uidUsuario),
    ])
  );

  const codigos = [codigoMiembro, ...perfiles.map((perfil) => perfil?.data?.codigoMiembro)];

  await Promise.all([
    ...codigos.map((codigo) => probarCorreo(correoInternoDeCodigo(codigo))),
    probarCorreo(correo),
  ]);

  return { uids: [...uids], idMiembros, codigoMiembro };
};
