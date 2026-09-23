'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

import { canEditHealth, esMiembroDeSuAlcance } from 'src/utils/member-access';

import {
  getCachedMemberByIdentifier,
  getResolvedMemberByIdentifier,
  getCachedResolvedMemberByIdentifier,
} from 'src/services/member-context-service';

import { SplashScreen } from 'src/components/loading-screen';

import { MemberEditHealthForm } from 'src/sections/member/member-edit-health-form';

import { useAuthContext } from 'src/auth/hooks';

export default function Page() {
  const { id } = useParams();
  const { user, loading } = useAuthContext();

  const [hydrated, setHydrated] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  // Editar la Dispensa Médica exige el permiso `salud.editar` del catálogo
  // (igual que Ascenso con `ascenso.editar`), para que el panel de "Administrar
  // permisos" pueda dejarla en solo lectura.
  // Igual que la ficha y el Sistema de Ascenso: el permiso dice que sabe, el
  // alcance dice sobre quien.
  const canManage = canEditHealth(user) && esMiembroDeSuAlcance(user, currentMember);

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
    return <SplashScreen title="Cargando salud" subtitle="Preparando el expediente..." />;
  }

  if (loading) {
    return <SplashScreen title="Verificando acceso" subtitle="Casi listo..." />;
  }

  if (!currentMember) {
    return <div>Miembro no encontrado</div>;
  }

  return <MemberEditHealthForm currentMember={currentMember} readOnly={!canManage} />;
}
