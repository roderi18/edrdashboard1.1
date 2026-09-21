'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

import {
  canEditMembers,
  esMiembroDeSuAlcance,
  canMemberManageMembers,
  puedeEditarSuPropiaFicha,
} from 'src/utils/member-access';

import {
  getMemberDirectoryMetadata,
  getResolvedMemberByIdentifier,
} from 'src/services/member-context-service';
import { obtenerIntegranteDelCuatrienioPorId } from 'src/services/directiva-cuatrienios-service';

import { SplashScreen } from 'src/components/loading-screen';

import { MemberEditLayout } from 'src/sections/member/layout/member-edit-layout';
import { MemberCreateEditForm } from 'src/sections/member/member-create-edit-form';
import { PerfilDirectivaNacional } from 'src/sections/national/cuatrienios/perfil-directiva-nacional';

import { useAuthContext } from 'src/auth/hooks';

export default function Page() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const { user, loading } = useAuthContext();
  const cuatrienio = searchParams.get('cuatrienio') || '';
  const integranteId = searchParams.get('integrante') || '';
  const esPerfilHistorico = Boolean(cuatrienio && integranteId);

  const [hydrated, setHydrated] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  const [integranteHistorico, setIntegranteHistorico] = useState(null);
  const [availableDests, setAvailableDests] = useState([]);
  // Editar la ficha exige `miembros.editar` del catálogo, igual que Dispensa
  // Médica con `salud.editar` y Ascenso con `ascenso.editar`. Sin esta condición
  // toda sesión de administrador editaba, incluidos los cargos de supervisión
  // (sección, región y Consejo Nacional), que son de solo consulta.
  // El permiso dice que sabe editar fichas; el alcance, de quien. Sin la segunda
  // condicion, sumar los cargos de alguien —correcto— le abria la ficha de
  // cualquier miembro de la organizacion.
  const canManage =
    (!user || user.role !== 'member' ? true : canMemberManageMembers(user)) &&
    canEditMembers(user) &&
    esMiembroDeSuAlcance(user, currentMember);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (esPerfilHistorico) {
          const integrante = await obtenerIntegranteDelCuatrienioPorId(cuatrienio, integranteId);
          if (
            !cancelled &&
            integrante &&
            String(integrante.id) === String(id) &&
            String(integrante.cuatrienio) === String(cuatrienio)
          ) {
            setIntegranteHistorico(integrante);
          }
          return;
        }

        const [metadata, member] = await Promise.all([
          getMemberDirectoryMetadata(),
          getResolvedMemberByIdentifier(id, { includeMetadata: true, includePhoto: true }),
        ]);

        if (cancelled) return;

        setAvailableDests(metadata?.dests || []);
        setCurrentMember(member);
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [cuatrienio, esPerfilHistorico, id, integranteId]);
  if (!hydrated) {
    return <SplashScreen title="Cargando miembro" subtitle="Preparando su perfil..." />;
  }

  if (loading) {
    return <SplashScreen title="Verificando acceso" subtitle="Casi listo..." />;
  }

  if (esPerfilHistorico) {
    if (!integranteHistorico) return <div>Perfil histórico no encontrado</div>;
    return <PerfilDirectivaNacional integrante={integranteHistorico} activeTab="general" />;
  }

  if (!currentMember) {
    return <div>Miembro no encontrado</div>;
  }

  return (
    <MemberEditLayout member={currentMember}>
      <MemberCreateEditForm
        currentMember={currentMember}
        // Su propia ficha nunca se le enmascara, aunque no gestione miembros.
        // Lo que cambie ahi va a aprobacion, no directo a la base de datos.
        readOnly={!canManage && !puedeEditarSuPropiaFicha(user, currentMember)}
        availableDests={availableDests}
      />
    </MemberEditLayout>
  );
}
