// ----------------------------------------------------------------------
// Cuantos destacamentos y cuantos miembros cuelgan de una seccion o de una
// region.
//
// La API no devuelve estos numeros: los campos existen pero llegan vacios, y
// por eso las fichas mostraban 0 mientras los listados mostraban el valor bueno
// —cada uno lo calculaba por su cuenta, y solo el listado lo hacia—.
//
// La cadena es: seccion -> iglesias -> destacamentos -> miembros. El
// destacamento no guarda su seccion; la guarda su iglesia, y por eso hace falta
// pasar por ellas.
// ----------------------------------------------------------------------

const normalizarId = (valor) => String(valor ?? '').trim();

const getIdSeccionDeIglesia = (iglesia = {}) =>
  normalizarId(iglesia?.idSeccion ?? iglesia?.sectionId ?? iglesia?.seccionId);

const getIdIglesiaDeDestacamento = (dest = {}) =>
  normalizarId(dest?.idIglesia ?? dest?.churchId);

const getIdDestacamento = (dest = {}) => normalizarId(dest?.idDestacamento ?? dest?.id);

const getIdDestacamentoDeMiembro = (miembro = {}) =>
  normalizarId(miembro?.idDestacamento ?? miembro?.destId);

const getIdSeccion = (seccion = {}) => normalizarId(seccion?.idSeccion ?? seccion?.id);

const getIdRegionDeSeccion = (seccion = {}) =>
  normalizarId(seccion?.idRegion ?? seccion?.regionalId ?? seccion?.regionId);

/**
 * Destacamentos y miembros de UNA seccion.
 */
export const contarSeccion = ({ idSeccion, churches = [], dests = [], members = [] } = {}) => {
  const seccion = normalizarId(idSeccion);

  if (!seccion) return { destacamentos: 0, miembros: 0 };

  const iglesiasDeLaSeccion = new Set(
    churches.filter((i) => getIdSeccionDeIglesia(i) === seccion).map((i) => normalizarId(i.idIglesia ?? i.id))
  );

  const destacamentos = dests.filter((d) => iglesiasDeLaSeccion.has(getIdIglesiaDeDestacamento(d)));
  const idsDestacamentos = new Set(destacamentos.map(getIdDestacamento));

  return {
    destacamentos: destacamentos.length,
    miembros: members.filter((m) => idsDestacamentos.has(getIdDestacamentoDeMiembro(m))).length,
  };
};

/**
 * Secciones, destacamentos y miembros de UNA region.
 */
export const contarRegion = ({
  idRegion,
  sectionals = [],
  churches = [],
  dests = [],
  members = [],
} = {}) => {
  const region = normalizarId(idRegion);

  if (!region) return { secciones: 0, destacamentos: 0, miembros: 0 };

  const seccionesDeLaRegion = sectionals.filter((s) => getIdRegionDeSeccion(s) === region);

  return seccionesDeLaRegion.reduce(
    (acumulado, seccion) => {
      const { destacamentos, miembros } = contarSeccion({
        idSeccion: getIdSeccion(seccion),
        churches,
        dests,
        members,
      });

      return {
        secciones: acumulado.secciones + 1,
        destacamentos: acumulado.destacamentos + destacamentos,
        miembros: acumulado.miembros + miembros,
      };
    },
    { secciones: 0, destacamentos: 0, miembros: 0 }
  );
};
