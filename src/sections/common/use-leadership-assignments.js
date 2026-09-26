'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import { valorGuardado } from 'src/utils/cache-de-lecturas.mjs';
import { esOficialEspecial } from 'src/utils/cargos-compatibles.mjs';
import { obtenerFotosPrincipalesPorEntidad } from 'src/utils/firebase-photos';
import {
  buildOrgIndex,
  describirCargoDeDirectiva,
  buildLeadershipMemberOptions,
} from 'src/utils/leadership-member-options';
import {
  buscarPosicionPorNodo,
  normalizarIdAsignacion,
  construirResumenMiembro,
  resolverMiembroAsignado,
  indexarAsignacionesPorPosicion,
} from 'src/utils/leadership-assignments';

import { getDestsApi } from 'src/services/dest-service';
import { getMembers } from 'src/services/member-service';
import { getChurches } from 'src/services/church-service';
import { getRegionals } from 'src/services/regional-service';
import { useLecturasVivas } from 'src/lib/avisos-de-lecturas';
import { getSectionals } from 'src/services/sectional-service';
import { getNivelesARetirar, DIRECTIVA_POSITIONS } from 'src/catalogs/directiva-positions';
import {
  esNivelDeConsejo,
  guardarAsignacionDirectiva,
  obtenerAsignacionesDirectiva,
  asignacionesDirectivaGuardadas,
  obtenerAsignacionesDirectivaMiembros,
  desactivarAsignacionesDirectivaPorNivel,
} from 'src/services/directivas-organizacionales-service';

import { toast } from 'src/components/snackbar';

import { useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------
// Asignacion de miembros en las Directivas de SECCION, REGION y NACION.
//
// El organigrama del destacamento tiene su propia coleccion; los demas niveles se
// apoyan en `asignacionesDirectiva`, que ya es generica por nivel + entidad. Cada
// nodo del diagrama se casa con una posicion del catalogo por `idNodoDiagrama`,
// que es lo que da el `idPosicionDirectiva` con el que se guarda.
//
// FIRESTORE ES LA UNICA FUENTE. `asignacionesDirectiva` es lo que leen las TRES
// pantallas que hablan de cargos: este organigrama, la ficha del miembro y la
// columna "Posicion" de la lista. Escribir aqui basta para que las tres digan lo
// mismo.
//
// Hubo una epoca en que cada cambio se replicaba ademas en `CargosMiembros` (la
// API .NET) porque la ficha leia de alli. Eran dos escrituras sin transaccion
// sobre un endpoint con clave compuesta que ni comprueba duplicados, y bastaba
// que una fallara — o que a alguien se le olvidara un caso, como el ocupante
// desplazado — para que la ficha y el organigrama mostraran cosas distintas. Ya
// nadie lee esa API para cargos, asi que la segunda escritura desaparecio.
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// AQUI SE CAMBIA EL TIEMPO DE LA ESPERA DE "Asignando...".
//
// Era una espera deliberada de 600 ms entre el clic en "Asignar" y el pintado de
// la casilla, como acuse de recibo. Se pidió lo contrario: asignar en cualquier
// directiva tiene que ser INSTANTÁNEO. Ahora vale 0: la casilla se pinta en el
// mismo clic (pintado optimista) y la escritura viaja por detrás; si falla, se
// deshace y se avisa.
//
// Rige los CUATRO organigramas: nacion, region y seccion por este hook, y el del
// destacamento importando esta misma constante.
// ----------------------------------------------------------------------
export const RETARDO_ASIGNACION_MS = 0;

const esperar = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const findPositionByNode = (nivel, nodeId) =>
  buscarPosicionPorNodo(DIRECTIVA_POSITIONS, nivel, nodeId);

const conFotos = (memberRows, fotos) =>
  (Array.isArray(memberRows) ? memberRows : []).map((member) => ({
    ...member,
    avatarUrl: fotos?.[String(member?.id)]?.urlFoto || member?.avatarUrl || '',
  }));

// Lo que `load` pide, si ya está entero en la caché de lecturas (mismas claves
// que usan los servicios). Con ello el organigrama se pinta en el primer render
// al volver a él, sin esqueleto ni casillas "Vacante" de paso.
const datosDeHoyGuardados = () => {
  const memberRows = valorGuardado('miembros:');
  const dests = valorGuardado('destacamentos:false');
  const churches = valorGuardado('iglesias:');
  const sectionals = valorGuardado('secciones:false');
  const regionals = valorGuardado('regiones:true');
  const fotos = valorGuardado('fotos:miembro|perfil');

  if ([memberRows, dests, churches, sectionals, regionals, fotos].some((v) => v === undefined)) {
    return null;
  }

  return {
    members: conFotos(memberRows, fotos),
    orgIndex: buildOrgIndex({ dests, churches, sectionals, regionals }),
  };
};

export function useLeadershipAssignments({
  nivel,
  idEntidad,
  nombreEntidad = '',
  canManage = true,
  // Apagado cuando el organigrama pinta un cuatrienio guardado: sus ocupantes
  // vienen de la historia, y leer el padron y la directiva de hoy solo gastaba
  // una API lenta para pintar lo que no se va a usar.
  conDatosDeHoy = true,
}) {
  // Quien actua. Sin esto, la puerta de cambios no sabia que quien remueve es el
  // Administrador Global, dejaba el cambio PENDIENTE de aprobacion y la casilla
  // volvia a su estado anterior: se anunciaba "removido" y reaparecia la persona.
  const { user } = useAuthContext();
  const [guardadoAlMontar] = useState(() => (conDatosDeHoy ? datosDeHoyGuardados() : null));
  const [members, setMembers] = useState(() => guardadoAlMontar?.members || []);
  const [orgIndex, setOrgIndex] = useState(
    () => guardadoAlMontar?.orgIndex || buildOrgIndex({})
  );
  const [miembrosListos, setMiembrosListos] = useState(() => Boolean(guardadoAlMontar));
  // Asignaciones activas de esta directiva, indexadas por idPosicionDirectiva.
  const [assignments, setAssignments] = useState(() => {
    const guardadas = conDatosDeHoy ? asignacionesDirectivaGuardadas({ nivel, idEntidad }) : null;

    return guardadas ? indexarAsignacionesPorPosicion(guardadas) : {};
  });
  // De qué directiva son las `assignments` que hay: al cambiar de entidad, las
  // de la anterior no pueden pintarse bajo el nombre de la nueva.
  const [asignacionesDe, setAsignacionesDe] = useState(() =>
    conDatosDeHoy && asignacionesDirectivaGuardadas({ nivel, idEntidad })
      ? `${nivel}:${idEntidad || ''}`
      : ''
  );
  // Cargos de consejo de OTRAS entidades: quien figure aqui no puede recibir uno
  // en esta directiva.
  const [asignacionesDeConsejo, setAsignacionesDeConsejo] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [nodoARemover, setNodoARemover] = useState(null);
  // Miembro elegido que ya sirve en otro consejo: espera el "si, quitalo de alli".
  const [traspasoPendiente, setTraspasoPendiente] = useState(null);
  // Solo esta en alto durante la espera de `RETARDO_ASIGNACION_MS`, no mientras
  // se escribe: la escritura va por detras y no bloquea la interfaz.
  const [isSaving, setIsSaving] = useState(false);
  // Sube cuando otra sesión cambia personas o directivas: se relee solo.
  const cambiosDeMiembros = useLecturasVivas(['miembros:', 'fotos:']);
  const cambiosDeDirectiva = useLecturasVivas(['directiva:']);

  useEffect(() => {
    let cancelled = false;

    if (!conDatosDeHoy) return undefined;

    const load = async () => {
      const [memberRows, dests, churches, sectionals, regionals, fotos] = await Promise.all([
        getMembers().catch(() => []),
        getDestsApi({ includePhotos: false }).catch(() => []),
        getChurches().catch(() => []),
        getSectionals({ includePhotos: false }).catch(() => []),
        getRegionals().catch(() => []),
        // Las fotos viven en Firebase, no en la lista que devuelve la API: sin
        // pedirlas aparte, toda persona salia con el avatar generico.
        obtenerFotosPrincipalesPorEntidad({ tipoEntidad: 'miembro' }).catch(() => ({})),
      ]);

      if (cancelled) return;

      setMembers(conFotos(memberRows, fotos));
      setOrgIndex(buildOrgIndex({ dests, churches, sectionals, regionals }));
      setMiembrosListos(true);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [conDatosDeHoy, cambiosDeMiembros]);

  const loadAssignments = useCallback(async () => {
    if (!conDatosDeHoy) return;
    if (!idEntidad && nivel !== 'nacional') return;

    const rows = await obtenerAsignacionesDirectiva({ nivel, idEntidad }).catch(() => []);

    setAssignments(indexarAsignacionesPorPosicion(rows));
    setAsignacionesDe(`${nivel}:${idEntidad || ''}`);

    // Cargos de consejo FUERA de esta directiva. Nadie sirve en dos consejos a la
    // vez, asi que quien ya este en uno tiene que salir deshabilitado aqui: el
    // servicio lo rechaza igualmente, pero enterarse al pulsar "Asignar" es tarde.
    if (!esNivelDeConsejo(nivel)) {
      setAsignacionesDeConsejo([]);
      return;
    }

    const todas = await obtenerAsignacionesDirectivaMiembros().catch(() => []);

    setAsignacionesDeConsejo(
      todas.filter(
        (asignacion) =>
          esNivelDeConsejo(asignacion?.nivel) &&
          !(
            asignacion?.nivel === nivel &&
            String(asignacion?.idEntidad || '') === String(idEntidad || '')
          ) &&
          // En una región o sección, ser Oficial Especial no ocupa: se puede
          // tener las dos cosas y no hay nada que preguntar ni que retirar.
          !((nivel === 'regional' || nivel === 'seccional') &&
            esOficialEspecial(asignacion?.idPosicionDirectiva))
      )
    );
    // `cambiosDeDirectiva` no se lee dentro: está para releer cuando otra sesión
    // asigna o quita a alguien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nivel, idEntidad, conDatosDeHoy, cambiosDeDirectiva]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // Miembro que ocupa el nodo del diagrama, o null.
  const getAssignedMember = useCallback(
    (nodeId) => {
      const position = findPositionByNode(nivel, nodeId);
      const asignacion = position ? assignments[normalizarIdAsignacion(position.idCargo)] : null;

      return resolverMiembroAsignado({ asignacion, members });
    },
    [assignments, members, nivel]
  );

  // Cargo que ya ocupa cada miembro dentro de ESTA directiva, para deshabilitarlo
  // en el desplegable.
  const ocupantesPorMiembro = useMemo(() => {
    const porMiembro = new Map();

    Object.values(assignments).forEach((asignacion) => {
      if (!asignacion?.idMiembro) return;

      const position = DIRECTIVA_POSITIONS.find(
        (item) =>
          normalizarIdAsignacion(item.idCargo) ===
          normalizarIdAsignacion(asignacion.idPosicionDirectiva)
      );

      porMiembro.set(
        normalizarIdAsignacion(asignacion.idMiembro),
        describirCargoDeDirectiva({
          nombreCargo: position?.nombreCargo,
          nivel,
          idEntidad,
          index: orgIndex,
        })
      );
    });

    return porMiembro;
  }, [assignments, nivel, idEntidad, orgIndex]);

  // Cargo que ya ocupa cada miembro en OTRO consejo. No deshabilita: al elegir a
  // esa persona se pregunta si se le quita de alli, igual que al remover.
  const ocupantesEnOtroConsejo = useMemo(() => {
    const porMiembro = new Map();

    asignacionesDeConsejo.forEach((asignacion) => {
      if (!asignacion?.idMiembro) return;

      const position = DIRECTIVA_POSITIONS.find(
        (item) =>
          normalizarIdAsignacion(item.idCargo) ===
          normalizarIdAsignacion(asignacion.idPosicionDirectiva)
      );

      porMiembro.set(
        normalizarIdAsignacion(asignacion.idMiembro),
        describirCargoDeDirectiva({
          nombreCargo: position?.nombreCargo,
          nivel: asignacion.nivel,
          idEntidad: asignacion.idEntidad,
          index: orgIndex,
        })
      );
    });

    return porMiembro;
  }, [asignacionesDeConsejo, orgIndex]);

  // Memoizado a proposito: sin esto las opciones se recreaban en cada render y el
  // Autocomplete perdia la seleccion recien hecha.
  const memberOptions = useMemo(() => {
    const asignado = selectedNode ? getAssignedMember(selectedNode.id) : null;

    return buildLeadershipMemberOptions({
      members,
      nivel,
      idEntidad,
      index: orgIndex,
      ocupantesPorMiembro,
      ocupantesEnOtroConsejo,
      idMiembroActual: normalizarIdAsignacion(asignado?.id ?? asignado?.idMiembros) || null,
    });
  }, [
    members,
    nivel,
    idEntidad,
    orgIndex,
    ocupantesPorMiembro,
    ocupantesEnOtroConsejo,
    selectedNode,
    getAssignedMember,
  ]);

  const openAssign = useCallback(
    (node) => {
      if (!canManage) return;

      setSelectedNode(node);
      setSelectedMember(getAssignedMember(node?.id) || null);
    },
    [canManage, getAssignedMember]
  );

  const closeAssign = useCallback(() => {
    // Durante la espera de "Asignando..." el dialogo no se cierra: son 400 ms y
    // cerrarlo a medias dejaria la barra huerfana.
    if (isSaving) return;

    setSelectedNode(null);
    setSelectedMember(null);
  }, [isSaving]);

  // El nodo llega por parametro y no desde `selectedNode`: al remover se actua
  // sobre un nodo distinto del que tenga abierto el dialogo, y leerlo del estado
  // daria el valor anterior al render.
  const guardar = useCallback(
    async ({ node, idMiembro, miembro, activo, reemplazarConsejo = false }) => {
      // La comprobacion de verdad esta en firestore.rules; esta solo evita
      // lanzar una escritura que el servidor va a rechazar.
      if (!canManage) {
        toast.error('No tienes permiso para modificar esta directiva.');
        return false;
      }

      const position = findPositionByNode(nivel, node?.id);

      if (!position) {
        toast.error('Este nodo no está en el catálogo de cargos.');
        return false;
      }

      const clavePosicion = normalizarIdAsignacion(position.idCargo);
      // Estado al que se vuelve si la escritura acaba fallando.
      const asignacionesPrevias = assignments;

      // Espera de cortesia con la barra "Asignando...". Ver RETARDO_ASIGNACION_MS
      // arriba, que es donde se cambia el tiempo. Remover no la lleva: retirar a
      // alguien no necesita que se note el esfuerzo.
      if (activo && idMiembro && RETARDO_ASIGNACION_MS > 0) {
        setIsSaving(true);
        await esperar(RETARDO_ASIGNACION_MS);
        setIsSaving(false);
      }

      // PINTADO OPTIMISTA. Pasada la espera, la casilla cambia sin aguardar a
      // Firestore ni a la API: el organigrama se redibuja y la escritura viaja
      // por detras. Si falla se revierte y se avisa, mas abajo.
      setAssignments((previas) => {
        const siguientes = { ...previas };

        if (activo && idMiembro) {
          siguientes[clavePosicion] = {
            idPosicionDirectiva: position.idCargo,
            idMiembro: normalizarIdAsignacion(idMiembro),
            idCargo: Number(position.idCargoApi) || null,
            nivel,
            idEntidad,
            division: position.division ?? null,
            orden: position.orden || 1,
            activo: true,
            // Numero, no Timestamp: `aMilisegundos` lo entiende igual y evita
            // depender de Firestore para una entrada que aun no se ha escrito.
            fechaActualizacion: Date.now(),
            ...construirResumenMiembro(miembro || {}),
          };
        } else {
          delete siguientes[clavePosicion];
        }

        return siguientes;
      });

      setSelectedNode(null);
      setSelectedMember(null);

      try {
        const asignacionGuardada = await guardarAsignacionDirectiva({
          usuario: user,
          nivel,
          idEntidad,
          nombreEntidad,
          idCargo: Number(position.idCargoApi) || null,
          idMiembro,
          idPosicionDirectiva: position.idCargo,
          division: position.division ?? null,
          orden: position.orden || 1,
          origen: 'organigrama-directiva',
          activo,
          // Ya se le pregunto y dijo que si: el servicio deja pasar el cambio
          // de consejo porque el cargo anterior se retira aqui debajo.
          reemplazarCargoDeConsejo: reemplazarConsejo,
          ...construirResumenMiembro(miembro || {}),
        });

        // Un miembro ocupa UNA posicion por nivel. El formulario de miembro ya
        // lo aplicaba; el organigrama no, y asignar desde el diagrama dejaba a
        // la persona con cargos activos en dos secciones a la vez.
        if (activo && idMiembro && !asignacionGuardada?.pendienteDeAprobacion) {
          // Al traspasar se retiran ademas los cargos de los OTROS consejos:
          // es lo que se acaba de confirmar, y es la misma lista de niveles
          // excluyentes que aplica la ficha del miembro.
          const niveles = reemplazarConsejo ? getNivelesARetirar(nivel) : [nivel];

          await Promise.all(
            niveles.map((nivelARetirar) =>
              desactivarAsignacionesDirectivaPorNivel({
                idMiembro,
                nivel: nivelARetirar,
                conservarIdAsignacion: asignacionGuardada?.idAsignacion || '',
                compatibleCon: { nivel, idPosicionDirectiva: position.idCargo },
              }).catch(() => 0)
            )
          );
        }

        // Ya no hay espejo en la API .NET: la ficha del miembro y la lista leen
        // estas mismas asignaciones, asi que escribir aqui es suficiente para
        // que las tres pantallas digan lo mismo.

        // Pendiente de aprobacion: no se ha escrito nada todavia. Se dice y se
        // vuelve a lo que hay, en vez de dejar la casilla pintada como si ya
        // estuviera hecho.
        if (asignacionGuardada?.pendienteDeAprobacion) {
          toast.info(
            'Cambio enviado a la Oficina Nacional y al Administrador Global. Se aplicará cuando lo aprueben.'
          );
        }

        // Reconcilia el pintado optimista con lo que quedo escrito de verdad.
        await loadAssignments();

        return asignacionGuardada?.pendienteDeAprobacion ? 'pendiente' : true;
      } catch (error) {
        console.error('[directiva] no se pudo guardar la asignación', error);

        // Se deshace el cambio y se relee el servidor, que es la version
        // buena: la instantanea local podria haberse quedado atras.
        setAssignments(asignacionesPrevias);
        loadAssignments().catch(() => {});

        toast.error(error?.message || 'No se pudo guardar la asignación. Se deshizo el cambio.');
        return false;
      }
    },
    [canManage, nivel, idEntidad, nombreEntidad, loadAssignments, assignments, user]
  );

  const asignarMiembro = useCallback(async () => {
    const idMiembro = normalizarIdAsignacion(selectedMember?.id ?? selectedMember?.idMiembros);

    if (!idMiembro) {
      toast.warning('Selecciona un miembro para asignarlo al cargo.');
      return;
    }

    // Ya tiene cargo —en esta directiva o en otra—: se puede elegir, pero no se
    // le mueve a espaldas de quien asigna. Se pregunta primero, igual que al
    // remover. El cargo anterior se retira al confirmar.
    // Quien YA ocupa este mismo nodo no se pregunta: no se le mueve de ningun
    // sitio, se esta reescribiendo la misma casilla.
    const asignado = getAssignedMember(selectedNode?.id);
    const yaEstaEnEsteNodo =
      normalizarIdAsignacion(asignado?.id ?? asignado?.idMiembros) === idMiembro;
    const cargoQueOcupa =
      ocupantesPorMiembro.get(idMiembro) || ocupantesEnOtroConsejo.get(idMiembro);

    if (cargoQueOcupa && !yaEstaEnEsteNodo) {
      setTraspasoPendiente({
        node: selectedNode,
        idMiembro,
        miembro: selectedMember,
        cargoQueOcupa,
      });

      return;
    }

    if (
      (await guardar({ node: selectedNode, idMiembro, miembro: selectedMember, activo: true })) ===
      true
    ) {
      toast.success('Miembro asignado correctamente.');
    }
  }, [
    guardar,
    getAssignedMember,
    ocupantesPorMiembro,
    ocupantesEnOtroConsejo,
    selectedMember,
    selectedNode,
  ]);

  // --- Traspaso: confirmar que se le quita del otro consejo ---

  const cancelarTraspaso = useCallback(() => {
    setTraspasoPendiente(null);
  }, []);

  const confirmarTraspaso = useCallback(async () => {
    const pendiente = traspasoPendiente;

    setTraspasoPendiente(null);

    if (!pendiente?.idMiembro) return;

    if (
      (await guardar({
        node: pendiente.node,
        idMiembro: pendiente.idMiembro,
        miembro: pendiente.miembro,
        activo: true,
        reemplazarConsejo: true,
      })) === true
    ) {
      toast.success('Miembro asignado correctamente.');
    }
  }, [guardar, traspasoPendiente]);

  // --- Remover: se pide confirmacion antes de liberar el cargo ---

  const pedirRemoverMiembro = useCallback(
    (node) => {
      if (!canManage) return;

      if (!getAssignedMember(node?.id)) {
        toast.info('Este cargo no tiene un miembro asignado.');
        return;
      }

      setNodoARemover(node);
    },
    [canManage, getAssignedMember]
  );

  const cancelarRemover = useCallback(() => {
    setNodoARemover(null);
  }, []);

  const confirmarRemover = useCallback(async () => {
    const asignado = getAssignedMember(nodoARemover?.id);
    const idMiembro = normalizarIdAsignacion(asignado?.id ?? asignado?.idMiembros);

    if (!idMiembro) {
      setNodoARemover(null);
      return;
    }

    if (
      (await guardar({ node: nodoARemover, idMiembro, miembro: asignado, activo: false })) === true
    ) {
      toast.success('Miembro removido del cargo.');
    }

    setNodoARemover(null);
  }, [getAssignedMember, guardar, nodoARemover]);

  // Mientras falten las personas o las asignaciones de ESTA directiva, el árbol
  // enseña su esqueleto: antes salía entero con "Vacante" y se llenaba después.
  const sinEntidad = !idEntidad && nivel !== 'nacional';
  const cargando =
    conDatosDeHoy &&
    !sinEntidad &&
    (!miembrosListos || asignacionesDe !== `${nivel}:${idEntidad || ''}`);

  return {
    cargando,
    members,
    memberOptions,
    getAssignedMember,
    selectedNode,
    selectedMember,
    setSelectedMember,
    isSaving,
    guardar,
    openAssign,
    closeAssign,
    asignarMiembro,
    nodoARemover,
    pedirRemoverMiembro,
    cancelarRemover,
    confirmarRemover,
    traspasoPendiente,
    cancelarTraspaso,
    confirmarTraspaso,
  };
}
