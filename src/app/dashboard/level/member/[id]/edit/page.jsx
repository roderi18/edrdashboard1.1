'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { obtenerFotoPrincipal } from 'src/utils/firebase-photos';

import { mapApiMemberToUI } from 'src/services/member-service';

import { MemberEditLayout } from 'src/sections/member/layout/member-edit-layout';
import { MemberCreateEditForm } from 'src/sections/member/member-create-edit-form';

export default function Page() {
  const { id } = useParams();

  const [hydrated, setHydrated] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/members');

      const data = await res.json();

      const allMembers = data?.Data || [];
      const resDests = await fetch('/api/dest');
      const dataDests = await resDests.json();
      const dests = dataDests?.Data || [];

      const resChurches = await fetch('/api/churches');
      const dataChurches = await resChurches.json();
      const churches = dataChurches?.Data || [];

      const resSectionals = await fetch('/api/sectional');
      const dataSectionals = await resSectionals.json();
      const sectionals = dataSectionals?.Data || [];

      const resRegionals = await fetch('/api/regional');
      const dataRegionals = await resRegionals.json();
      const regionals = dataRegionals?.Data || [];

      const member = allMembers.find(
        (m) => String(m.idMiembros) === String(id) || String(m.codigoMiembro) === String(id)
      );

      const dest = dests.find((d) => Number(d.idDestacamento) === Number(member?.idDestacamento));

      const church = churches.find((c) => Number(c.idIglesia) === Number(dest?.idIglesia));

      const sectional = sectionals.find((s) => Number(s.idSeccion) === Number(church?.idSeccion));

      const regional = regionals.find((r) => Number(r.id) === Number(sectional?.idRegion));

      const mapped = mapApiMemberToUI(member);
      const memberPhoto = await obtenerFotoPrincipal({
        tipoEntidad: 'miembro',
        idEntidad: mapped?.id,
      });

      setCurrentMember({
        ...mapped,
        avatarUrl: memberPhoto?.urlFoto || mapped?.avatarUrl || null,
        sectionalName: sectional?.nombre || '-',
        regionalName: regional?.nombre || '-',
      });
      setHydrated(true);
    };

    load();
  }, [id]);
  if (!hydrated) return null;

  if (!currentMember) {
    return <div>Miembro no encontrado</div>;
  }

  return (
    <MemberEditLayout>
      <MemberCreateEditForm currentMember={currentMember} />
    </MemberEditLayout>
  );
}
