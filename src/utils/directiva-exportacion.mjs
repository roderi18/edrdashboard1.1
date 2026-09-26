// ----------------------------------------------------------------------
// LA DIRECTIVA NACIONAL PARA EXPORTAR (Excel y PDF).
//
// La lista de pantalla se ordena por estructura y cargo, así que las secciones
// de una región quedaban lejos de su región y el documento no se podía leer
// como un organigrama. Para exportar va primero el Consejo Ejecutivo y después
// cada región, con sus secciones justo debajo; cada bloque lleva una fila de
// encabezado (`esEncabezado`) para que en el papel se vea dónde empieza.
// Puro: recibe las filas de la lista tal cual y no pide nada.
// ----------------------------------------------------------------------

const texto = (valor) => String(valor ?? '').trim();

const porCargo = (a, b) =>
  (a.hierarchyStructureOrder ?? 999) - (b.hierarchyStructureOrder ?? 999) ||
  (a.hierarchyRoleOrder ?? 9999) - (b.hierarchyRoleOrder ?? 9999) ||
  texto(a.nationalXname).localeCompare(texto(b.nationalXname), 'es');

const agruparPorEntidad = (filas) =>
  filas.reduce((mapa, fila) => {
    const id = texto(fila.entityId);
    mapa.set(id, [...(mapa.get(id) || []), fila]);
    return mapa;
  }, new Map());

const encabezado = (nivel, id, titulo) => ({
  id: `encabezado:${nivel}:${id}`,
  esEncabezado: true,
  nivel,
  titulo,
});

/**
 * @param filas Las filas de la lista nacional (`level`, `entityId`, orden de cargo).
 * @param regionDeSeccion (idSeccion) => idRegion, '' si no se sabe.
 * @param tituloDeRegion  (idRegion) => "Región Norte".
 * @param tituloDeSeccion (idSeccion) => "Sección Oriental I".
 */
export const ordenarDirectivaParaExportar = (
  filas = [],
  {
    regionDeSeccion = () => '',
    tituloDeRegion = (id) => `Región ${id}`,
    tituloDeSeccion = (id) => `Sección ${id}`,
  } = {}
) => {
  const nacionales = filas.filter((fila) => !['regional', 'seccional'].includes(fila.level));
  const porRegion = agruparPorEntidad(filas.filter((fila) => fila.level === 'regional'));
  const porSeccion = agruparPorEntidad(filas.filter((fila) => fila.level === 'seccional'));

  // Una región sale aunque solo tenga secciones con gente: es su encabezado.
  const idsDeRegion = new Set([
    ...porRegion.keys(),
    ...[...porSeccion.keys()].map((idSeccion) => texto(regionDeSeccion(idSeccion))).filter(Boolean),
  ]);
  const porTitulo = (tituloDe) => (a, b) => tituloDe(a).localeCompare(tituloDe(b), 'es');
  const seccionesDe = (idRegion) =>
    [...porSeccion.keys()]
      .filter((idSeccion) => texto(regionDeSeccion(idSeccion)) === idRegion)
      .sort(porTitulo(tituloDeSeccion));
  const bloqueDeSeccion = (idSeccion) => [
    encabezado('seccional', idSeccion, tituloDeSeccion(idSeccion)),
    ...porSeccion.get(idSeccion).sort(porCargo),
  ];

  const salida = [];

  if (nacionales.length) {
    salida.push(
      encabezado('nacional', 'nacional', 'Consejo Ejecutivo'),
      ...nacionales.sort(porCargo)
    );
  }

  [...idsDeRegion].sort(porTitulo(tituloDeRegion)).forEach((idRegion) => {
    salida.push(
      encabezado('regional', idRegion, tituloDeRegion(idRegion)),
      ...(porRegion.get(idRegion) || []).sort(porCargo),
      ...seccionesDe(idRegion).flatMap(bloqueDeSeccion)
    );
  });

  // Una sección cuya región no se conoce no se pierde: va al final, aparte.
  const huerfanas = [...porSeccion.keys()]
    .filter((idSeccion) => !texto(regionDeSeccion(idSeccion)))
    .sort(porTitulo(tituloDeSeccion));

  if (huerfanas.length) {
    salida.push(
      encabezado('regional', 'sin-region', 'Secciones sin región'),
      ...huerfanas.flatMap(bloqueDeSeccion)
    );
  }

  return salida;
};
