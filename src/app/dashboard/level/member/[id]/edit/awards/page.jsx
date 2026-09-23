'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

import {
  canEditAwards,
  esMiembroDeSuAlcance,
  canMemberManageMembers,
} from 'src/utils/member-access';

import {
  getCachedMemberByIdentifier,
  getResolvedMemberByIdentifier,
  getCachedResolvedMemberByIdentifier,
} from 'src/services/member-context-service';

import { SplashScreen } from 'src/components/loading-screen';

import { MemberEditAwardsForm } from 'src/sections/member/awards/member-edit-awards-form';

import { useAuthContext } from 'src/auth/hooks';

export default function Page() {
  const { id } = useParams();
  const { user, loading } = useAuthContext();

  const [hydrated, setHydrated] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  // Editar el Sistema de Ascenso exige el permiso `ascenso.editar` del catálogo
  // (el Usuario Común solo tiene `ascenso.ver`, por eso queda en solo lectura).
  //
  // Y exige además que el miembro sea de SU destacamento: el ascenso lo lleva
  // quien acompaña a esa persona, no cualquiera con el permiso. Vale también
  // para subir documentos, que es la misma pantalla.
  const canManage =
    (!user || user.role !== 'member' ? true : canMemberManageMembers(user)) &&
    canEditAwards(user) &&
    esMiembroDeSuAlcance(user, currentMember);

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

        if (!cancelled) {
          setCurrentMember(member);
        }

        void getResolvedMemberByIdentifier(id, {
          includeMetadata: true,
          includePhoto: true,
        }).then((memberWithPhoto) => {
          if (!cancelled && memberWithPhoto) setCurrentMember(memberWithPhoto);
        });
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    // `finally` ya deja la pestaña hidratada aunque falle; el `catch` es para
    // que el rechazo no quede sin dueño y Next lo pinte encima de lo cargado.
    load().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!hydrated) {
    return <SplashScreen title="Cargando premios" subtitle="Preparando el historial..." />;
  }

  if (loading) {
    return <SplashScreen title="Verificando acceso" subtitle="Casi listo..." />;
  }

  if (!currentMember) {
    return <div>Miembro no encontrado</div>;
  }

  return <MemberEditAwardsForm currentMember={currentMember} readOnly={!canManage} />;
}
