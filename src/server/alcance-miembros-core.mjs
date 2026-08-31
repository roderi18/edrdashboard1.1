// ----------------------------------------------------------------------
// A QUIEN VE CADA QUIEN, DICHO EN EL SERVIDOR.
//
// El navegador ya lo decide en `member-access.js`, pero eso solo ordena lo que
// PINTA: la lista completa ya viajo hasta el. Quien pida `/api/members` con su
// token y lea la respuesta, o abra la consola, tiene el padron entero —nombres,
// telefonos, direcciones y fechas de nacimiento de menores incluidos—.
//
// Este modulo es la misma regla, pura y sin dependencias, para poder aplicarla
// tambien al salir. Es el mismo patron de `alcance-gestion-miembros-core.mjs`:
// lo que decide un acceso se escribe donde se pueda probar y compartir.
//
// La regla, de abajo arriba (la misma que ya aplica la pantalla):
//   sin cargo o cargo de destacamento -> los de SU destacamento
//   cargo de seccion                  -> los de todos los destacamentos de su seccion
//   cargo de region                   -> los de toda su region
//   cargo nacional o administrador    -> todos
// ----------------------------------------------------------------------

const texto = (valor) => String(valor ?? '').trim();

const lista = (valores) =>
  (Array.isArray(valores) ? valores : [valores]).map(texto).filter(Boolean);

/** Los cargos se guardan con el nivel de la directiva; de menor a mayor. */
const ORDEN_DE_NIVEL = ['destacamento', 'seccional', 'regional', 'nacional'];

/** Roles que ven toda la organizacion y no salen de ninguna casilla. */
const ROLES_SIN_ACOTAR = ['administrador_global', 'administrador_funcional', 'oficina_nacional'];

/**
 * Hasta donde llega quien pregunta: 'destacamento' | 'seccion' | 'region' | 'todo'.
 *
 * Sale del nivel MAS AMPLIO de sus cargos, no del principal: quien coordina su
 * destacamento y ademas ocupa una casilla en su seccion mira a los de toda la
 * seccion. `alcanceNivel` (el claim del token) entra como respaldo cuando la
 * sesion no trae la lista de cargos.
 */
export const nivelDeAlcanceDeMiembros = ({ rol = '', cargos = [], alcanceNivel = '' } = {}) => {
  if (ROLES_SIN_ACOTAR.includes(texto(rol).toLowerCase())) return 'todo';

  const niveles = (Array.isArray(cargos) ? cargos : [])
    .map((cargo) => texto(cargo?.nivel).toLowerCase())
    .filter((nivel) => ORDEN_DE_NIVEL.includes(nivel));

  const respaldo = texto(alcanceNivel).toLowerCase();

  if (!niveles.length) {
    if (['nacional', 'global'].includes(respaldo)) return 'todo';
    if (respaldo === 'region') return 'region';
    if (respaldo === 'seccion') return 'seccion';

    return 'destacamento';
  }

  const masAmplio = niveles.reduce((a, b) =>
    ORDEN_DE_NIVEL.indexOf(b) > ORDEN_DE_NIVEL.indexOf(a) ? b : a
  );

  return { destacamento: 'destacamento', seccional: 'seccion', regional: 'region', nacional: 'todo' }[
    masAmplio
  ];
};

const idsDeDestacamento = (destacamento = {}) =>
  lista([destacamento?.idDestacamento, destacamento?.id, destacamento?.destId]);

const seccionDeIglesia = (iglesia = {}) =>
  texto(iglesia?.idSeccion ?? iglesia?.sectionId ?? iglesia?.seccionId);

const idsDeIglesia = (entidad = {}) => lista([entidad?.idIglesia, entidad?.churchId, entidad?.id]);

/** La seccion de un destacamento: la suya si la trae, o la de su iglesia. */
const seccionDeDestacamento = (destacamento = {}, iglesias = []) => {
  const directa = texto(
    destacamento?.idSeccion ?? destacamento?.sectionalId ?? destacamento?.seccionId
  );

  if (directa) return directa;

  const suyas = idsDeIglesia(destacamento);
  const iglesia = iglesias.find((item) => idsDeIglesia(item).some((id) => suyas.includes(id)));

  return iglesia ? seccionDeIglesia(iglesia) : '';
};

const regionDeSeccion = (seccion = {}) =>
  texto(seccion?.idRegion ?? seccion?.regionalId ?? seccion?.regionId);

const idDeSeccion = (seccion = {}) => texto(seccion?.idSeccion ?? seccion?.id);

/**
 * Los destacamentos que caen dentro de su alcance, o `null` cuando la estructura
 * no alcanza para decidirlo.
 *
 * `null` NO es "ninguno": es "no lo se". Quien llama decide entonces si deja
 * pasar la lista sin acotar —para no dejar a nadie con la pantalla vacia— y lo
 * avisa. Devolver un conjunto vacio por no saber es como se rompen las listas.
 */
export const destacamentosDelAlcance = ({ nivel, alcance = {}, estructura = {} } = {}) => {
  const { destacamentos = [], iglesias = [], secciones = [] } = estructura;

  if (nivel === 'destacamento') {
    const suyos = lista(alcance?.destacamentos);

    return suyos.length ? new Set(suyos) : null;
  }

  if (!destacamentos.length) return null;

  if (nivel === 'seccion') {
    const suyas = new Set(lista(alcance?.secciones));

    if (!suyas.size) return null;

    return new Set(
      destacamentos
        .filter((destacamento) => suyas.has(seccionDeDestacamento(destacamento, iglesias)))
        .flatMap(idsDeDestacamento)
    );
  }

  if (nivel === 'region') {
    const suyas = new Set(lista(alcance?.regiones));

    if (!suyas.size || !secciones.length) return null;

    const seccionesDeSuRegion = new Set(
      secciones.filter((seccion) => suyas.has(regionDeSeccion(seccion))).map(idDeSeccion)
    );

    if (!seccionesDeSuRegion.size) return null;

    return new Set(
      destacamentos
        .filter((destacamento) =>
          seccionesDeSuRegion.has(seccionDeDestacamento(destacamento, iglesias))
        )
        .flatMap(idsDeDestacamento)
    );
  }

  return null;
};

const destacamentoDelMiembro = (miembro = {}) =>
  texto(miembro?.idDestacamento ?? miembro?.destId ?? miembro?.destamentoId);

const idDelMiembro = (miembro = {}) => texto(miembro?.idMiembros ?? miembro?.id);

/**
 * Los miembros que puede ver, o `null` si no se puede decidir (ver arriba).
 *
 * Su propia ficha entra siempre: es suya, y sin esto quien no tiene destacamento
 * asignado se quedaria sin poder verse.
 */
export const miembrosDelAlcance = ({ acceso = {}, miembros = [], estructura = {} } = {}) => {
  const nivel = nivelDeAlcanceDeMiembros(acceso);

  if (nivel === 'todo') return miembros;

  const propio = texto(acceso?.idMiembros);
  const alcance = acceso?.alcance ?? acceso;

  let permitidos = destacamentosDelAlcance({ nivel, alcance, estructura });

  // SIN CARGO NO HAY ALCANCE, PERO SI HAY DESTACAMENTO.
  //
  // El Usuario Comun —que es la mayoria— no ocupa ninguna casilla, asi que su
  // alcance viene vacio y sin esto se le devolvia el padron entero por no saber
  // acotarlo. Pero PERTENECE a un destacamento, y ahi es un miembro mas: se saca
  // de su propia ficha, que ya viene en la lista que estamos filtrando. Es lo
  // mismo que hace la pantalla en `filtrarMiembrosDeSuDestacamento`.
  if (!permitidos && nivel === 'destacamento' && propio) {
    const suFicha = (Array.isArray(miembros) ? miembros : []).find(
      (miembro) => idDelMiembro(miembro) === propio
    );
    const suDestacamento = destacamentoDelMiembro(suFicha ?? {});

    if (suDestacamento) permitidos = new Set([suDestacamento]);
  }

  if (!permitidos) return null;

  return (Array.isArray(miembros) ? miembros : []).filter(
    (miembro) =>
      (propio && idDelMiembro(miembro) === propio) ||
      permitidos.has(destacamentoDelMiembro(miembro))
  );
};
