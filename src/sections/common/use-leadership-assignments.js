'use client';

import { useState, useEffect, useCallback } from 'react';

import {
  buildOrgIndex,
  buildLeadershipMemberOptions,
} from 'src/utils/leadership-member-options';

import { getDestsApi } from 'src/services/dest-service';
import { getMembers } from 'src/services/member-service';
import { getChurches } from 'src/services/church-service';
import { getSectionals } from 'src/services/sectional-service';
import { DIRECTIVA_POSITIONS } from 'src/catalogs/directiva-positions';
import { guardarCargoMiembroApi } from 'src/services/cargos-api-service';
import {
  guardarAsignacionDirectiva,
  obtenerAsignacionesDirectiva,
} from 'src/services/directivas-organizacionales-service';

import { toast } from 'src/components/snackbar';

// ----------------------------------------------------------------------
// Asignacion de miembros en las Directivas de SECCION y REGION.
//
// El organigrama del destacamento tiene su propia coleccion; seccion y region se
// apoyan en `asignacionesDirectiva`, que ya es generica por nivel + entidad. Cada
// nodo del diagrama se casa con una posicion del catalogo por `idNodoDiagrama`,
// que es lo que da el `idPosicionDirectiva` con el que se guarda.
// ----------------------------------------------------------------------

const normalizeId = (value) => String(value ?? '').trim();

// Los ids de nodo de los diagramas y los del catalogo describen lo mismo pero no
// siempre se escriben igual ("sub-director-regional" frente a
// "subdirector-regional"), asi que se comparan sin guiones ni acentos.
const nodeKey = (value) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

// Posicion del catalogo que corresponde a un nodo del diagrama.
const findPositionByNode = (nivel, nodeId) => {
  const key = nodeKey(nodeId);

  if (!key) return null;

  return (
    DIRECTIVA_POSITIONS.find(
      (position) =>
        position.nivel === nivel &&
        (nodeKey(position.idNodoDiagrama) === key || nodeKey(position.idCargo) === key)
    ) || null
  );
};

export function useLeadershipAssignments({ nivel, idEntidad, nombreEntidad = '' }) {
  const [members, setMembers] = useState([]);
  const [orgIndex, setOrgIndex] = useState(() => buildOrgIndex({}));
  // Asignaciones activas de esta directiva, indexadas por idPosicionDirectiva.
  const [assignments, setAssignments] = useState({});
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
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
    if (!idEntidad) return;

    const rows = await obtenerAsignacionesDirectiva({ nivel, idEntidad }).catch(() => []);

    setAssignments(
      rows.reduce((acc, asignacion) => {
        const key = normalizeId(asignacion.idPosicionDirectiva);
        if (key) acc[key] = asignacion;
        return acc;
      }, {})
    );
  }, [nivel, idEntidad]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // Miembro que ocupa el nodo del diagrama, o null.
  const getAssignedMember = useCallback(
    (nodeId) => {
      const position = findPositionByNode(nivel, nodeId);
      const asignacion = position ? assignments[normalizeId(position.idCargo)] : null;

      if (!asignacion?.idMiembro) return null;

      return (
        members.find(
          (member) => normalizeId(member?.id ?? member?.idMiembros) === normalizeId(asignacion.idMiembro)
        ) || null
      );
    },
    [assignments, members, nivel]
  );

  // Cargo que ya ocupa cada miembro dentro de ESTA directiva, para deshabilitarlo
  // en el desplegable.
  const ocupantesPorMiembro = new Map();
  Object.values(assignments).forEach((asignacion) => {
    const position = DIRECTIVA_POSITIONS.find(
      (item) => normalizeId(item.idCargo) === normalizeId(asignacion.idPosicionDirectiva)
    );

    if (asignacion?.idMiembro) {
      ocupantesPorMiembro.set(
        normalizeId(asignacion.idMiembro),
        position?.nombreCargo || 'un cargo de esta directiva'
      );
    }
  });

  const memberOptions = buildLeadershipMemberOptions({
    members,
    nivel,
    idEntidad,
    index: orgIndex,
    ocupantesPorMiembro,
    idMiembroActual: selectedNode
      ? normalizeId(getAssignedMember(selectedNode.id)?.id ?? getAssignedMember(selectedNode.id)?.idMiembros)
      : null,
  });

  const openAssign = useCallback(
    (node) => {
      setSelectedNode(node);
      setSelectedMember(getAssignedMember(node?.id) || null);
    },
    [getAssignedMember]
  );

  const closeAssign = useCallback(() => {
    if (isSaving) return;

    setSelectedNode(null);
    setSelectedMember(null);
  }, [isSaving]);

  const guardar = useCallback(
    async ({ idMiembro, activo }) => {
      const position = findPositionByNode(nivel, selectedNode?.id);

      if (!position) {
        toast.error('Este nodo no está en el catálogo de cargos.');
        return false;
      }

      setIsSaving(true);

      try {
        const idCargo = Number(position.idCargoApi) || null;

        await guardarAsignacionDirectiva({
          nivel,
          idEntidad,
          nombreEntidad,
          idCargo,
          idMiembro,
          idPosicionDirectiva: position.idCargo,
          division: position.division ?? null,
          orden: position.orden || 1,
          origen: 'organigrama-directiva',
          activo,
        });

        // El cargo también se registra en la API, que es de donde sale la columna
        // "Posición" de la lista de miembros: si no, el organigrama y la lista
        // dirían cosas distintas.
        if (activo && idCargo && idMiembro) {
          await guardarCargoMiembroApi({
            idCargo,
            idMiembro,
            fechaInicio: new Date().toISOString().slice(0, 10),
            fechaFin: null,
          }).catch(() => null);
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
    [nivel, idEntidad, nombreEntidad, selectedNode, loadAssignments]
  );

  const asignarMiembro = useCallback(async () => {
    const idMiembro = normalizeId(selectedMember?.id ?? selectedMember?.idMiembros);

    if (!idMiembro) {
      toast.warning('Selecciona un miembro para asignarlo al cargo.');
      return;
    }

    if (await guardar({ idMiembro, activo: true })) {
      toast.success('Miembro asignado correctamente.');
    }
  }, [guardar, selectedMember]);

  const removerMiembro = useCallback(
    async (node) => {
      const asignado = getAssignedMember(node?.id);
      const idMiembro = normalizeId(asignado?.id ?? asignado?.idMiembros);

      if (!idMiembro) return;

      setSelectedNode(node);

      if (await guardar({ idMiembro, activo: false })) {
        toast.success('Miembro removido del cargo.');
      }
    },
    [getAssignedMember, guardar]
  );

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
    removerMiembro,
  };
}
