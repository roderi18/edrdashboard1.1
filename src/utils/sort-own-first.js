// ----------------------------------------------------------------------
// Orden por defecto de las listas de niveles organizacionales (regiones,
// secciones y destacamentos): PRIMERO las entidades del alcance del usuario.
//
// Un Coordinador Regional de la Región Este debe abrir /regional y encontrar la
// Región Este arriba; lo mismo para su sección en /sectional y su destacamento
// en /dest. Es solo un orden INICIAL: en cuanto el usuario ordena por una
// columna (`table.hasUserSorted`), manda su criterio y esta función no se aplica.
//
// La partición es ESTABLE: dentro de "propias" y "ajenas" se conserva el orden
// que traía la lista (el del comparador de la tabla), así que ordenar por nombre
// sigue funcionando igual dentro de cada grupo.
// ----------------------------------------------------------------------

export const sortOwnFirst = (rows = [], isOwnRow) => {
  if (typeof isOwnRow !== 'function' || rows.length < 2) {
    return rows;
  }

  const own = [];
  const rest = [];

  rows.forEach((row) => {
    if (isOwnRow(row)) {
      own.push(row);
    } else {
      rest.push(row);
    }
  });

  // Sin coincidencias (o todas propias) se devuelve la lista original para no
  // crear un array nuevo en cada render sin necesidad.
  if (!own.length || !rest.length) {
    return rows;
  }

  return [...own, ...rest];
};
