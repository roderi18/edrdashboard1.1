'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';

import { buildOrgIndex, buildLeadershipMemberOptions } from 'src/utils/leadership-member-options';
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
import { getSectionals } from 'src/services/sectional-service';
import { DIRECTIVA_POSITIONS } from 'src/catalogs/directiva-positions';
import {
  asegurarCargoMiembroApi,
  retirarCargoMiembroApiPorCargo,
} from 'src/services/cargos-api-service';
import {
  guardarAsignacionDirectiva,
  obtenerAsignacionesDirectiva,
  desactivarAsignacionesDirectivaPorNivel,
} from 'src/services/directivas-organizacionales-service';

import { toast } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Asignacion de miembros en las Directivas de SECCION, REGION y NACION.
//
// El organigrama del destacamento tiene su propia coleccion; los demas niveles se
// apoyan en `asignacionesDirectiva`, que ya es generica por nivel + entidad. Cada
// nodo del diagrama se casa con una posicion del catalogo por `idNodoDiagrama`,
// que es lo que da el `idPosicionDirectiva` con el que se guarda.
//
// FIRESTORE MANDA, PERO LA API .NET SE MANTIENE AL DIA. La lista de miembros
// resuelve la posicion desde las asignaciones, pero la FICHA del miembro tambien
// lee `CargosMiembros` (ver `positionsByCargoApi` en member-create-edit-form): si
// aqui solo se tocaba Firestore, remover a alguien del organigrama lo dejaba con
// el cargo puesto en su perfil. Por eso cada cambio se replica en la API.
//
// La escritura sigue sin ser transaccional, que fue el motivo por el que en su dia
// se quito: la diferencia es que ahora el fallo de la segunda escritura SE AVISA
// en pantalla en vez de descartarse, que era lo que dejaba divergir las bases
// mientras la pantalla confirmaba el guardado.
// ----------------------------------------------------------------------

const findPositionByNode = (nivel, nodeId) =>
  buscarPosicionPorNodo(DIRECTIVA_POSITIONS, nivel, nodeId);

export function useLeadershipAssignments({
  nivel,
  idEntidad,
  nombreEntidad = '',
  canManage = true,
}) {
  const [members, setMembers] = useState([]);
  const [orgIndex, setOrgIndex] = useState(() => buildOrgIndex({}));
  // Asignaciones activas de esta directiva, indexadas por idPosicionDirectiva.
  const [assignments, setAssignments] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [nodoARemover, setNodoARemover] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [memberRows, dests, churches, sectionals] = await Promise.all([
        getMembers().catch(() => []),
        getDestsApi({ includePhotos: false }).catch(() => []),
        getChurches().catch(() => []),
        getSectionals({ includePhotos: false }).catch(() => []),
      ]);

      if (cancelled) return;

      setMembers(Array.isArray(memberRows) ? memberRows : []);
      setOrgIndex(buildOrgIndex({ dests, churches, sectionals }));
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadAssignments = useCallback(async () => {
    if (!idEntidad && nivel !== 'nacional') return;

    const rows = await obtenerAsignacionesDirectiva({ nivel, idEntidad }).catch(() => []);

    setAssignments(indexarAsignacionesPorPosicion(rows));
  }, [nivel, idEntidad]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // Miembro que ocupa el nodo del diagrama, o null.
  const getAssignedMember = useCallback(
    (nodeId) => {
      const position = findPositionByNode(nivel, nodeId);
      const asignacion = position
        ? assignments[normalizarIdAsignacion(position.idCargo)]
        : null;

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
        position?.nombreCargo || 'un cargo de esta directiva'
      );
    });

    return porMiembro;
  }, [assignments]);

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
      idMiembroActual: normalizarIdAsignacion(asignado?.id ?? asignado?.idMiembros) || null,
    });
  }, [members, nivel, idEntidad, orgIndex, ocupantesPorMiembro, selectedNode, getAssignedMember]);

  const openAssign = useCallback(
    (node) => {
      if (!canManage) return;

      setSelectedNode(node);
      setSelectedMember(getAssignedMember(node?.id) || null);
    },
    [canManage, getAssignedMember]
  );

  const closeAssign = useCallback(() => {
    if (isSaving) return;

    setSelectedNode(null);
    setSelectedMember(null);
  }, [isSaving]);

  // El nodo llega por parametro y no desde `selectedNode`: al remover se actua
  // sobre un nodo distinto del que tenga abierto el dialogo, y leerlo del estado
  // daria el valor anterior al render.
  const guardar = useCallback(
    async ({ node, idMiembro, miembro, activo }) => {
      // La comprobacion de verdad esta en firestore.rules; esta solo evita
      // lanzar una escritura que el servidor va a rechazar.
      if (!canManage) {
        toast.error('Solo el administrador global puede modificar la directiva.');
        return false;
      }

      const position = findPositionByNode(nivel, node?.id);

      if (!position) {
        toast.error('Este nodo no está en el catálogo de cargos.');
        return false;
      }

      setIsSaving(true);

      try {
        const asignacionGuardada = await guardarAsignacionDirectiva({
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
          ...construirResumenMiembro(miembro || {}),
        });

        // Un miembro ocupa UNA posicion por nivel. El formulario de miembro ya lo
        // aplicaba; el organigrama no, y asignar desde el diagrama dejaba a la
        // persona con cargos activos en dos secciones a la vez.
        if (activo && idMiembro) {
          await desactivarAsignacionesDirectivaPorNivel({
            idMiembro,
            nivel,
            conservarIdAsignacion: asignacionGuardada?.idAsignacion || '',
          }).catch(() => 0);
        }

        // Espejo en la API .NET, que es de donde la ficha del miembro lee sus
        // cargos. Sin esto el cambio hecho aqui no llegaba al perfil.
        const idCargoApi = Number(position.idCargoApi) || null;

        if (idCargoApi && idMiembro) {
          try {
            if (activo) {
              await asegurarCargoMiembroApi({ idCargo: idCargoApi, idMiembro });
            } else {
              await retirarCargoMiembroApiPorCargo({ idMiembro, idCargoApi });
            }
          } catch (error) {
            console.error('[directiva] no se pudo sincronizar el cargo con la ficha', error);
            toast.warning(
              'La directiva se actualizó, pero la ficha del miembro no pudo sincronizarse. Vuelve a guardar para reintentarlo.'
            );
          }
        }

        await loadAssignments();
        setSelectedNode(null);
        setSelectedMember(null);

        return true;
      } catch (error) {
        console.error('[directiva] no se pudo guardar la asignación', error);
        toast.error(error?.message || 'No se pudo guardar la asignación.');

        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [canManage, nivel, idEntidad, nombreEntidad, loadAssignments]
  );

  const asignarMiembro = useCallback(async () => {
    const idMiembro = normalizarIdAsignacion(selectedMember?.id ?? selectedMember?.idMiembros);

    if (!idMiembro) {
      toast.warning('Selecciona un miembro para asignarlo al cargo.');
      return;
    }

    if (await guardar({ node: selectedNode, idMiembro, miembro: selectedMember, activo: true })) {
      toast.success('Miembro asignado correctamente.');
    }
  }, [guardar, selectedMember, selectedNode]);

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
    if (isSaving) return;

    setNodoARemover(null);
  }, [isSaving]);

  const confirmarRemover = useCallback(async () => {
    const asignado = getAssignedMember(nodoARemover?.id);
    const idMiembro = normalizarIdAsignacion(asignado?.id ?? asignado?.idMiembros);

    if (!idMiembro) {
      setNodoARemover(null);
      return;
    }

    if (await guardar({ node: nodoARemover, idMiembro, miembro: asignado, activo: false })) {
      toast.success('Miembro removido del cargo.');
    }

    setNodoARemover(null);
  }, [getAssignedMember, guardar, nodoARemover]);

  return {
    members,
    memberOptions,
    getAssignedMember,
    selectedNode,
    selectedMember,
    setSelectedMember,
    isSaving,
    openAssign,
    closeAssign,
    asignarMiembro,
    nodoARemover,
    pedirRemoverMiembro,
    cancelarRemover,
    confirmarRemover,
  };
}
