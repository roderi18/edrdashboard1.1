import { getMemberFullName } from 'src/utils/get-member-fullname';

import { getMembers } from 'src/services/member-service';

// ----------------------------------------------------------------------
// LOS COMPAÑEROS DEL DESTACAMENTO DE LA PERSONA, PARA EL BOTÓN "CONTACTOS".
//
// Vivía en el layout del panel y corría en cada arranque: pedía el padrón entero
// (la API .NET no filtra) solo para este botón, abriera o no. Ahora lo llama el
// propio botón al abrirse o al pasar por encima, y el padrón sale de la caché de
// lecturas si otra pantalla ya lo pidió.
// ----------------------------------------------------------------------

const idsDe = (miembro) => [
  miembro?.id,
  miembro?.idMiembros,
  miembro?.memberId,
  miembro?.codigoMiembro,
];

export async function cargarContactosDelDestacamento(user) {
  const miembros = await getMembers();

  const idMiembroActual = String(user?.idMiembros ?? user?.memberId ?? user?.id ?? '');
  const miembroActual = miembros.find((miembro) =>
    idsDe(miembro).some((id) => String(id ?? '') === idMiembroActual)
  );
  const idDestacamento = String(
    miembroActual?.destId ??
      miembroActual?.idDestacamento ??
      miembroActual?.destacamentoId ??
      user?.destId ??
      user?.idDestacamento ??
      user?.alcance?.destacamentos?.[0] ??
      ''
  );

  if (!idDestacamento) return [];

  return miembros
    .filter((miembro) => {
      const mismoDestacamento =
        String(miembro?.destId ?? miembro?.idDestacamento ?? miembro?.destacamentoId ?? '') ===
        idDestacamento;
      const esLaPersonaActual = idsDe(miembro).some(
        (id) => String(id ?? '') === idMiembroActual
      );

      return mismoDestacamento && !esLaPersonaActual;
    })
    .map((miembro) => ({
      ...miembro,
      id: miembro.id ?? miembro.idMiembros ?? miembro.memberId,
      idMiembros: miembro.idMiembros ?? miembro.id ?? miembro.memberId,
      name:
        getMemberFullName(miembro) ||
        miembro.name ||
        [miembro.nombres, miembro.apellidos].filter(Boolean).join(' ') ||
        'Miembro',
      avatarUrl: miembro.avatarUrl || miembro.photoURL || miembro.urlFoto || '',
    }));
}
