import { generateMemberId } from 'src/utils/generate-member-id';
import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import { ejerceAdministradorGlobal } from 'src/utils/administrador-global-reina.mjs';
import {
  idIntegrante,
  claveDeTexto,
  nombreDelCargo,
  planDelListado,
  claveDePersona,
  nombreCompleto,
  buscarPorNombre,
  cargoDePosicion,
  GRUPOS_CUATRIENIO,
  NIVELES_CUATRIENIO,
} from 'src/utils/directiva-cuatrienios.mjs';

import { getDivisions } from 'src/services/division-service';
import { getDestsApi, createDestApi } from 'src/services/dest-service';
import { DIRECTIVA_POSITIONS } from 'src/catalogs/directiva-positions';
import { getMembers, createMemberApi } from 'src/services/member-service';
import { getChurches, createChurchApi } from 'src/services/church-service';
import { getRegionals, saveRegional } from 'src/services/regional-service';
import { getSectionals, saveSectional } from 'src/services/sectional-service';
import { DIRECTIVA_2022_2026, ID_CUATRIENIO_LISTADO } from 'src/catalogs/directiva-2022-2026.mjs';
import { obtenerAsignacionesDirectivaMiembros } from 'src/services/directivas-organizacionales-service';

import {
  guardarIntegrantes,
  congelarFotoDePerfil,
  obtenerIntegrantesDelCuatrienio,
} from './directiva-cuatrienios-service';

// ----------------------------------------------------------------------
// Carga del listado 2022-2026 y "foto" de la directiva de hoy.
//
// LA CARGA DEL LISTADO crea en el padron (API .NET) lo que falta —las secciones
// que el documento nombra y no existen, y a las personas que no estan— y luego
// guarda el cuatrienio. Las personas nuevas se crean como miembros normales, con
// su codigo EDR correlativo, en un destacamento "Provisional" (region y seccion
// "Provisional"), porque no se sabe el suyo: despues se trasladan a mano.
//
// Crear en el padron es cosa del Administrador Global (las rutas de la API lo
// exigen), asi que esta carga solo la corre el. Corregir la historia la pueden
// hacer tambien la Oficina Nacional.
//
// Se puede correr dos veces sin duplicar: las entidades y las personas se buscan
// por nombre antes de crearlas, y las filas del cuatrienio tienen id fijo.
// ----------------------------------------------------------------------

export const NOMBRE_PROVISIONAL = 'Provisional';

const nombreDeFila = (fila) =>
  fila?.nombre ?? fila?.sectionalName ?? fila?.name ?? fila?.regionalName ?? '';

const clavePersonaDeMiembro = (miembro) =>
  claveDePersona(miembro?.firstName ?? miembro?.nombres, miembro?.lastName ?? miembro?.apellidos);

const indexarMiembros = (miembros = []) => {
  const porClave = new Map();

  miembros.forEach((miembro) => {
    const clave = clavePersonaDeMiembro(miembro);

    if (!clave) return;

    porClave.set(clave, [...(porClave.get(clave) || []), miembro]);
  });

  return porClave;
};

export const puedeImportarListado = (usuario) => ejerceAdministradorGlobal(usuario);

// ----------------------------------------------------------------------
// El plan: que se va a crear y que ya existe. No escribe nada.
// ----------------------------------------------------------------------

export async function planificarImportacion() {
  const [regiones, secciones, miembros, yaGuardados] = await Promise.all([
    getRegionals({ includePhotos: false }),
    getSectionals({ includePhotos: false }),
    getMembers(),
    obtenerIntegrantesDelCuatrienio(ID_CUATRIENIO_LISTADO).catch(() => []),
  ]);
  const plan = planDelListado(DIRECTIVA_2022_2026, ID_CUATRIENIO_LISTADO);
  const miembrosPorClave = indexarMiembros(miembros);

  const entidades = [
    { nivel: NIVELES_CUATRIENIO.regional, nombre: NOMBRE_PROVISIONAL, alias: [] },
    {
      nivel: NIVELES_CUATRIENIO.seccional,
      nombre: NOMBRE_PROVISIONAL,
      region: NOMBRE_PROVISIONAL,
      alias: [],
    },
    ...plan.entidades,
  ].map((entidad) => {
    const filas = entidad.nivel === NIVELES_CUATRIENIO.regional ? regiones : secciones;
    const existente = buscarPorNombre(filas, entidad.nombre, {
      alias: entidad.alias,
      obtenerNombre: nombreDeFila,
    });

    return { ...entidad, existente: existente ? String(existente.id) : '' };
  });

  // Una persona por clave: Mirke de Leon sale dos veces (cargo y ex comandante)
  // y es una sola persona que crear.
  const personas = new Map();

  plan.integrantes.forEach((integrante) => {
    if (personas.has(integrante.clavePersona)) return;

    const coincidencias = miembrosPorClave.get(integrante.clavePersona) || [];

    personas.set(integrante.clavePersona, {
      clave: integrante.clavePersona,
      nombres: integrante.nombres,
      apellidos: integrante.apellidos,
      // Una sola coincidencia es esa persona. Varias no se adivinan: se guarda
      // el nombre sin enlazar y se corrige a mano.
      accion: coincidencias.length === 1 ? 'existe' : coincidencias.length > 1 ? 'dudosa' : 'crear',
      miembro: coincidencias.length === 1 ? coincidencias[0] : null,
      coincidencias: coincidencias.length,
    });
  });

  const guardadosPorId = new Map(yaGuardados.map((fila) => [fila.id, fila]));

  return {
    cuatrienio: ID_CUATRIENIO_LISTADO,
    entidades,
    personas: [...personas.values()],
    integrantes: plan.integrantes.map((integrante) => ({
      ...integrante,
      yaGuardado: guardadosPorId.has(integrante.id),
    })),
    ignorados: plan.ignorados,
    vacantes: plan.vacantes,
  };
}

// ----------------------------------------------------------------------
// La carga.
// ----------------------------------------------------------------------

const esperar = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

// La API tarda en devolver lo que se acaba de crear: se mira unas pocas veces
// antes de darlo por perdido, igual que hace el alta de miembros.
const buscarConEspera = async (buscar, intentos = 4) => {
  for (let intento = 0; intento < intentos; intento += 1) {
    if (intento > 0) await esperar(900);

    const encontrado = await buscar();

    if (encontrado) return encontrado;
  }

  return null;
};

const exigirId = (fila, que) => {
  const id = fila?.id ?? fila?.idSeccion ?? fila?.idRegion;

  if (!id)
    throw new Error(`Se creó ${que}, pero no aparece todavía en el padrón. Vuelve a intentarlo.`);

  return String(id);
};

const asegurarRegion = async ({ nombre, alias = [], usuario }) => {
  const buscar = async () =>
    buscarPorNombre(await getRegionals({ includePhotos: false }), nombre, {
      alias,
      obtenerNombre: nombreDeFila,
    });

  const existente = await buscar();

  if (existente) return existente;

  await saveRegional({ idRegion: 0, nombre, idPais: 1 }, { usuario });

  return { id: exigirId(await buscarConEspera(buscar), `la región ${nombre}`), name: nombre };
};

const asegurarSeccion = async ({ nombre, alias = [], idRegion, usuario }) => {
  const buscar = async () =>
    buscarPorNombre(await getSectionals({ includePhotos: false }), nombre, {
      alias,
      obtenerNombre: nombreDeFila,
    });

  const existente = await buscar();

  if (existente) return existente;

  await saveSectional({ idSeccion: 0, nombre, idRegion: Number(idRegion) }, { usuario });

  return {
    id: exigirId(await buscarConEspera(buscar), `la sección ${nombre}`),
    sectionalName: nombre,
  };
};

// El destacamento Provisional cuelga de una iglesia, y la iglesia de la seccion
// Provisional: la API no admite un destacamento sin iglesia.
const asegurarDestacamentoProvisional = async ({ idSeccion, usuario }) => {
  const buscarIglesia = async () =>
    (await getChurches()).find(
      (iglesia) =>
        String(iglesia.idSeccion) === String(idSeccion) &&
        claveDeTexto(iglesia.name) === claveDeTexto(NOMBRE_PROVISIONAL)
    );

  let iglesia = await buscarIglesia();

  if (!iglesia) {
    await createChurchApi({
      churchName: NOMBRE_PROVISIONAL,
      pastor: NOMBRE_PROVISIONAL,
      street: NOMBRE_PROVISIONAL,
      sectionId: idSeccion,
    });
    iglesia = await buscarConEspera(buscarIglesia);
  }

  const idIglesia = exigirId(iglesia, 'la iglesia Provisional');
  const buscarDestacamento = async () =>
    (await getDestsApi({ includePhotos: false })).find(
      (destacamento) =>
        String(destacamento.churchId) === idIglesia &&
        claveDeTexto(destacamento.name) === claveDeTexto(NOMBRE_PROVISIONAL)
    );

  let destacamento = await buscarDestacamento();

  if (!destacamento) {
    await createDestApi(
      { name: NOMBRE_PROVISIONAL, churchId: idIglesia, sectionId: idSeccion },
      { usuario }
    );
    destacamento = await buscarConEspera(buscarDestacamento);
  }

  return exigirId(destacamento, 'el destacamento Provisional');
};

const idDivisionLiderazgo = async () => {
  const divisiones = await getDivisions().catch(() => []);

  return (
    divisiones.find((division) => claveDeTexto(division.name).includes('liderazgo'))?.id ?? null
  );
};

const crearMiembro = async ({
  persona,
  idDestacamento,
  idDivision,
  codigosReservados,
  usuario,
}) => {
  const codigoMiembro = await generateMemberId({ codigosReservados });

  codigosReservados.push(codigoMiembro);

  const respuesta = await createMemberApi(
    {
      idMiembros: 0,
      codigoMiembro,
      nombres: persona.nombres,
      apellidos: persona.apellidos,
      genero: null,
      fechaNacimiento: null,
      idDestacamento: Number(idDestacamento),
      telefono: null,
      direccion: null,
      correo: null,
      // Son adultos de la directiva: Liderazgo, y no la primera division de la
      // lista, que es la que pone la API cuando no se le dice ninguna.
      idDivision,
      estatusMiembro: 'activo',
      cargosmiembros: [],
      idDestacamentoNavigation: null,
      idDivisionNavigation: null,
      miembromeritos: [],
      participanteseventos: [],
      tutores: [],
      usuarios: [],
      idUniformes: [],
      uniformesMiembros: [],
    },
    { usuario }
  );
  const idMiembros = respuesta?.idMiembros ?? respuesta?.data?.idMiembros ?? null;

  if (!idMiembros) {
    throw new Error(`Se creó a ${nombreCompleto(persona)}, pero la API no devolvió su id.`);
  }

  return { idMiembros: String(idMiembros), codigoMiembro };
};

/**
 * Corre la carga. `alAvanzar(texto)` va contando por donde va: son decenas de
 * llamadas a una API lenta y la pantalla no puede quedarse muda.
 */
export async function ejecutarImportacion({ usuario, alAvanzar = () => {} }) {
  if (!puedeImportarListado(usuario)) {
    throw new Error(
      'La carga del listado crea miembros y secciones: solo la hace el Administrador Global.'
    );
  }

  alAvanzar('Revisando el padrón…');
  const plan = await planificarImportacion();

  // 1. Region, seccion y destacamento Provisional.
  alAvanzar('Creando la región, la sección y el destacamento Provisional…');
  const regionProvisional = await asegurarRegion({ nombre: NOMBRE_PROVISIONAL, usuario });
  const seccionProvisional = await asegurarSeccion({
    nombre: NOMBRE_PROVISIONAL,
    idRegion: regionProvisional.id,
    usuario,
  });
  const idDestacamento = await asegurarDestacamentoProvisional({
    idSeccion: seccionProvisional.id,
    usuario,
  });

  // 2. Las regiones y secciones del listado.
  const idRegionPorNombre = new Map();
  const idSeccionPorNombre = new Map();

  for (const entidad of plan.entidades.filter((e) => e.nombre !== NOMBRE_PROVISIONAL)) {
    alAvanzar(`Comprobando ${entidad.nombre}…`);

    if (entidad.nivel === NIVELES_CUATRIENIO.regional) {
      // En serie: cada alta necesita la anterior (la seccion, su region).
      const region = await asegurarRegion({
        nombre: entidad.nombre,
        alias: entidad.alias,
        usuario,
      });

      idRegionPorNombre.set(entidad.nombre, String(region.id));
    } else {
      const seccion = await asegurarSeccion({
        nombre: entidad.nombre,
        alias: entidad.alias,
        idRegion: idRegionPorNombre.get(entidad.region),
        usuario,
      });

      idSeccionPorNombre.set(`${entidad.region}|${entidad.nombre}`, String(seccion.id));
    }
  }

  // 3. Las personas que faltan.
  const idDivision = await idDivisionLiderazgo();
  const codigosReservados = [];
  const personaPorClave = new Map();
  const aCrear = plan.personas.filter((persona) => persona.accion === 'crear');
  let creadas = 0;

  for (const persona of plan.personas) {
    if (persona.accion === 'existe') {
      personaPorClave.set(persona.clave, {
        idMiembros: String(persona.miembro.id),
        codigoMiembro: persona.miembro.memberId || '',
        miembro: persona.miembro,
      });
    } else if (persona.accion === 'crear') {
      creadas += 1;
      alAvanzar(`Creando miembro ${creadas} de ${aCrear.length}: ${nombreCompleto(persona)}…`);
      // En serie: cada codigo EDR depende de los ya repartidos.
      personaPorClave.set(
        persona.clave,
        await crearMiembro({ persona, idDestacamento, idDivision, codigosReservados, usuario })
      );
    }
  }

  // 4. Las caras de quien ya tenia foto de perfil, copiadas (nunca enlazadas).
  const fotos = await obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'miembro' }).catch(
    () => ({})
  );
  const integrantes = [];
  let copiadas = 0;

  for (const integrante of plan.integrantes) {
    const persona = personaPorClave.get(integrante.clavePersona);
    const urlPerfil = persona?.idMiembros ? fotos[persona.idMiembros]?.urlFoto : '';
    let foto = { fotoUrl: '', fotoRuta: '' };

    if (urlPerfil) {
      copiadas += 1;
      alAvanzar(`Copiando fotos de perfil (${copiadas})…`);
      foto = await congelarFotoDePerfil({
        urlOrigen: urlPerfil,
        cuatrienio: plan.cuatrienio,
        idIntegrante: integrante.id,
      }).catch(() => ({ fotoUrl: '', fotoRuta: '' }));
    }

    integrantes.push({
      ...integrante,
      regionId: idRegionPorNombre.get(integrante.regionNombre) || '',
      seccionId:
        idSeccionPorNombre.get(`${integrante.regionNombre}|${integrante.seccionNombre}`) || '',
      idMiembros: persona?.idMiembros || '',
      codigoMiembro: persona?.codigoMiembro || '',
      ...foto,
    });
  }

  alAvanzar('Guardando el cuatrienio…');
  await guardarIntegrantes({
    cuatrienio: plan.cuatrienio,
    integrantes,
    usuario,
    descripcion: `Se cargó la Directiva ${plan.cuatrienio} desde el listado de la organización: ${integrantes.length} integrantes, ${creadas} miembros nuevos en el destacamento Provisional.`,
  });

  return {
    integrantes: integrantes.length,
    creadas,
    dudosas: plan.personas.filter((persona) => persona.accion === 'dudosa').length,
    ignorados: plan.ignorados.length,
  };
}

// ----------------------------------------------------------------------
// La foto de la directiva de HOY en un cuatrienio (el vigente, al empezar).
// ----------------------------------------------------------------------

const NIVELES_DE_LA_FOTO = [
  NIVELES_CUATRIENIO.nacional,
  NIVELES_CUATRIENIO.regional,
  NIVELES_CUATRIENIO.seccional,
];

export async function tomarFotoDeLaDirectivaActual({ cuatrienio, usuario, alAvanzar = () => {} }) {
  alAvanzar('Leyendo la directiva de hoy…');

  const [asignaciones, miembros, regiones, secciones, fotos] = await Promise.all([
    obtenerAsignacionesDirectivaMiembros(),
    getMembers(),
    getRegionals({ includePhotos: false }),
    getSectionals({ includePhotos: false }),
    obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'miembro' }).catch(() => ({})),
  ]);
  const miembroPorId = new Map(miembros.map((miembro) => [String(miembro.id), miembro]));
  const regionPorId = new Map(regiones.map((region) => [String(region.id), region]));
  const seccionPorId = new Map(secciones.map((seccion) => [String(seccion.id), seccion]));
  const integrantes = [];
  let copiadas = 0;

  for (const asignacion of asignaciones) {
    const nivel = asignacion?.nivel;

    if (!NIVELES_DE_LA_FOTO.includes(nivel) || asignacion?.activo === false) continue;

    const idPosicion = String(asignacion.idPosicionDirectiva || asignacion.idCargo || '');
    const cargo = cargoDePosicion(nivel, idPosicion) || 'provisional';
    const posicion = DIRECTIVA_POSITIONS.find((item) => item.idCargo === idPosicion);
    const seccion =
      nivel === NIVELES_CUATRIENIO.seccional
        ? seccionPorId.get(String(asignacion.idEntidad))
        : null;
    const region =
      nivel === NIVELES_CUATRIENIO.regional
        ? regionPorId.get(String(asignacion.idEntidad))
        : seccion
          ? regionPorId.get(String(seccion.regionalId))
          : null;
    const miembro = miembroPorId.get(String(asignacion.idMiembro));
    const nombres =
      miembro?.firstName || asignacion.nombresMiembro || asignacion.nombreMiembro || '';
    const apellidos = miembro?.lastName || asignacion.apellidosMiembro || '';
    const entidad = nombreDeFila(seccion) || nombreDeFila(region) || '';
    const id = idIntegrante({
      cuatrienio,
      nivel,
      entidad,
      grupo: GRUPOS_CUATRIENIO.directiva,
      // Un cargo que no es de los ocho no puede compartir id con otro: lleva su
      // propia posicion en el id.
      cargo:
        cargo === 'provisional'
          ? `provisional-${claveDeTexto(idPosicion).replace(/\s+/g, '-')}`
          : cargo,
    });
    const urlPerfil = fotos[String(asignacion.idMiembro)]?.urlFoto || '';
    let foto = { fotoUrl: '', fotoRuta: '' };

    if (urlPerfil) {
      copiadas += 1;
      alAvanzar(`Copiando fotos de perfil (${copiadas})…`);
      foto = await congelarFotoDePerfil({
        urlOrigen: urlPerfil,
        cuatrienio,
        idIntegrante: id,
      }).catch(() => ({ fotoUrl: '', fotoRuta: '' }));
    }

    integrantes.push({
      id,
      cuatrienio,
      nivel,
      grupo: GRUPOS_CUATRIENIO.directiva,
      cargo,
      cargoNombre:
        cargo === 'provisional' ? posicion?.nombreCargo || 'Cargo' : nombreDelCargo(nivel, cargo),
      idPosicionDirectiva: idPosicion || null,
      orden: cargo === 'provisional' ? 50 : undefined,
      regionId: region ? String(region.id) : '',
      regionNombre: nombreDeFila(region),
      seccionId: seccion ? String(seccion.id) : '',
      seccionNombre: nombreDeFila(seccion),
      idMiembros: String(asignacion.idMiembro || ''),
      codigoMiembro: miembro?.memberId || asignacion.codigoMiembro || '',
      nombres,
      apellidos,
      ...foto,
    });
  }

  alAvanzar('Guardando el cuatrienio…');
  await guardarIntegrantes({
    cuatrienio,
    integrantes,
    usuario,
    descripcion: `Se guardó la foto de la directiva de hoy en la Directiva ${cuatrienio}: ${integrantes.length} integrantes.`,
  });

  return { integrantes: integrantes.length };
}

/**
 * Actualiza la foto congelada de cada integrante de un cuatrienio con la foto
 * de perfil que tiene actualmente en su ficha.
 */
export async function cargarFotosActualesDelCuatrienio({
  cuatrienio,
  usuario,
  idsIntegrante = null,
  alAvanzar = () => {},
}) {
  const [integrantes, fotos] = await Promise.all([
    obtenerIntegrantesDelCuatrienio(cuatrienio),
    obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'miembro' }).catch(() => ({})),
  ]);
  const objetivo = integrantes.filter(
    (integrante) => !idsIntegrante || idsIntegrante.includes(integrante.id)
  );
  const conFotoActual = objetivo.filter(
    (integrante) => integrante.idMiembros && fotos[String(integrante.idMiembros)]?.urlFoto
  );
  const actualizados = [];
  let fallidas = 0;

  for (const [indice, integrante] of conFotoActual.entries()) {
    alAvanzar(`Copiando fotos actuales (${indice + 1} de ${conFotoActual.length})…`);

    try {
      const foto = await congelarFotoDePerfil({
        urlOrigen: fotos[String(integrante.idMiembros)].urlFoto,
        cuatrienio,
        // Evita que el navegador reutilice una copia anterior al sincronizar otra vez.
        idIntegrante: `${integrante.id}-foto-${Date.now()}-${indice}`,
      });

      if (foto.fotoUrl) {
        actualizados.push({ ...integrante, ...foto });
      } else {
        fallidas += 1;
      }
    } catch (error) {
      fallidas += 1;
      console.warn('[directiva-cuatrienios] no se pudo copiar la foto actual', error);
    }
  }

  if (actualizados.length) {
    await guardarIntegrantes({
      cuatrienio,
      integrantes: actualizados,
      anteriores: actualizados,
      usuario,
      descripcion: `Se actualizaron las fotos actuales de ${actualizados.length} integrantes en la Directiva ${cuatrienio}.`,
    });
  }

  return {
    actualizadas: actualizados.length,
    sinFoto: objetivo.length - conFotoActual.length,
    fallidas,
    anteriores: actualizados.map((integrante) => {
      const original = integrantes.find((fila) => fila.id === integrante.id);
      return {
        id: integrante.id,
        fotoUrl: original?.fotoUrl || '',
        fotoRuta: original?.fotoRuta || '',
      };
    }),
  };
}

export async function restaurarFotosDelCuatrienio({ cuatrienio, fotosAnteriores, usuario }) {
  const actuales = await obtenerIntegrantesDelCuatrienio(cuatrienio);
  const fotoAnteriorPorId = new Map(fotosAnteriores.map((fila) => [fila.id, fila]));
  const restaurados = actuales
    .filter((integrante) => fotoAnteriorPorId.has(integrante.id))
    .map((integrante) => ({ ...integrante, ...fotoAnteriorPorId.get(integrante.id) }));

  if (!restaurados.length) return 0;

  await guardarIntegrantes({
    cuatrienio,
    integrantes: restaurados,
    anteriores: actuales.filter((integrante) => fotoAnteriorPorId.has(integrante.id)),
    usuario,
    descripcion: `Se restauraron las fotos anteriores de ${restaurados.length} integrantes en la Directiva ${cuatrienio}.`,
  });

  return restaurados.length;
}
