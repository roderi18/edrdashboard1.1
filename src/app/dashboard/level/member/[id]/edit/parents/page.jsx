'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

import {
  canViewHealth,
  canEditMemberTutors,
  esMiembroDeSuAlcance,
  canDeleteMemberTutors,
  canViewMemberParentsTab,
} from 'src/utils/member-access';

import {
  getCachedMemberByIdentifier,
  getResolvedMemberByIdentifier,
  getCachedResolvedMemberByIdentifier,
} from 'src/services/member-context-service';

import { SplashScreen } from 'src/components/loading-screen';

import { MemberEditParentsForm } from 'src/sections/member/parents/member-edit-parents-form';

import { useAuthContext } from 'src/auth/hooks';

export default function Page() {
  const { id } = useParams();
  const { user, loading } = useAuthContext();

  const [hydrated, setHydrated] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);

  // Editar exige el permiso del catalogo Y que el miembro sea de su alcance: a
  // los padres de alguien les llama quien acompaña a esa persona, no cualquiera
  // que tenga el permiso. Quien solo puede ver, ve; el aviso de "informacion
  // oculta" y la solicitud de acceso los pone el propio layout.
  const esDeSuAlcance = esMiembroDeSuAlcance(user, currentMember);
  // Añadir y corregir lo puede cualquier cargo del destacamento; borrar, solo el
  // Coordinador y su Asistente.
  const puedeEditar = canEditMemberTutors(user) && esDeSuAlcance;
  const puedeEliminar = canDeleteMemberTutors(user) && esDeSuAlcance;
  const puedeVer = canViewMemberParentsTab(user);

  useEffect(() => {
    let cancelled = false;
    const cachedMember = getCachedMemberByIdentifier(id);
    const cachedResolvedMember = getCachedResolvedMemberByIdentifier(id, {
      includeMetadata: true,
      includePhoto: false,
    });

    if (cachedResolvedMember) {
      setCurrentMember(cachedResolvedMember);
      setHydrated(true);
    } else if (cachedMember) {
      setCurrentMember(cachedMember);
    }

    const load = async () => {
      try {
        const member = await getResolvedMemberByIdentifier(id, {
          includeMetadata: true,
          includePhoto: false,
        });

        if (!cancelled) setCurrentMember(member);

        void getResolvedMemberByIdentifier(id, {
          includeMetadata: true,
          includePhoto: true,
        }).then((memberWithPhoto) => {
          if (!cancelled && memberWithPhoto) setCurrentMember(memberWithPhoto);
        });
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!hydrated) {
    return <SplashScreen title="Cargando padres" subtitle="Preparando la información..." />;
  }

  if (loading) {
    return <SplashScreen title="Verificando acceso" subtitle="Casi listo..." />;
  }

  if (!currentMember) {
    return <div>Miembro no encontrado</div>;
  }

  return (
    puedeVer && (
      <MemberEditParentsForm
        idMiembro={currentMember?.id ?? currentMember?.idMiembros ?? ''}
        nombreDelMiembro={`${currentMember?.firstName ?? ''} ${currentMember?.lastName ?? ''}`.trim()}
        usuario={user}
        idDestacamento={currentMember?.destId ?? currentMember?.idDestacamento ?? null}
        readOnly={!puedeEditar}
        puedeEliminar={puedeEliminar}
        puedePrellenarDesdeSalud={canViewHealth(user) && esDeSuAlcance}
      />
    )
  );
}
