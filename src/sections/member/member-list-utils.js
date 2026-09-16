import { normalizeText } from 'src/utils/normalize-text';
import { getMemberFullName } from 'src/utils/get-member-fullname';
import { obtenerFotosPrincipalesEnCache } from 'src/utils/firebase-photos';

import { DIRECTIVA_POSITIONS } from 'src/catalogs/directiva-positions';

// ----------------------------------------------------------------------
export const ORDEN_CARGO_DEST = new Map(
  DIRECTIVA_POSITIONS.filter((position) => position.nivel === 'destacamento').flatMap((position) =>
    [position.idPosicionDirectiva, position.idCargo, position.idCargoApi]
      .filter(Boolean)
      .map((id) => [String(id), Number(position.orden) || Infinity])
  )
);

export const TABLE_HEAD = [
  { id: 'name', label: 'Nombre' },
  { id: 'destName', label: 'Destacamento', width: 250 },
  { id: 'memberPosition', label: 'Posición', width: 180 },
  { id: 'sectionalName', label: 'Sección', width: 160 },
  { id: 'memberDivision', label: 'División', width: 90 },
  { id: '', width: 88 },
];

export const getMemberAge = (birthdate) => {
  if (!birthdate) return null;

  const parsed = new Date(birthdate);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
    age--;
  }

  return age;
};

export const resolveMemberDivision = (member) => {
  const currentDivision = String(
    member?.memberDivision ?? member?.division ?? member?.divisionName ?? ''
  ).trim();

  if (currentDivision) {
    const normalized = currentDivision.toLowerCase();
    if (normalized.includes('lider')) return 'Liderazgo';
    if (normalized.includes('explor')) return 'Exploradores';
    if (normalized.includes('segu')) return 'Seguidores';
    if (normalized.includes('pion')) return 'Pioneros';
    if (normalized.includes('naveg')) return 'Navegantes';
    return currentDivision;
  }

  const age = getMemberAge(
    member?.birthDate || member?.birth || member?.dateOfBirth || member?.fechaNacimiento
  );

  if (age === null) return '';
  if (age >= 18) return 'Liderazgo';
  if (age >= 14) return 'Exploradores';
  if (age >= 11) return 'Seguidores';
  if (age >= 8) return 'Pioneros';
  if (age >= 5) return 'Navegantes';

  return '';
};

export const getDirectivaDivisionByMemberDivision = (memberDivision = '') => {
  const normalized = String(memberDivision || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized.includes('naveg')) return 'navegantes';
  if (normalized.includes('pion')) return 'pioneros';
  if (normalized.includes('segu')) return 'seguidores';
  if (normalized.includes('explor')) return 'exploradores';

  return '';
};

export const getCargoOptionValue = (cargo = {}) => cargo.idPosicionDirectiva || cargo.id || cargo.idCargo;

export const getCargoLabel = (cargo = {}) => {
  const cargoName = cargo.nombreCargo || cargo.nombre || cargo.label || '';

  if (cargo.nivel === 'destacamento' && cargo.nombreDivision && !cargoName.includes('(')) {
    return `${cargoName} (${cargo.nombreDivision})`;
  }

  return cargoName;
};

export const mapMemberToTableRow = (member) => ({
  ...member,
  id: member.id,
  idMiembros: member.id,
  memberId: member.memberId || member.codigoMiembro || member.id,
  destId: member.destId || member.idDestacamento || '',
  avatarUrl: member.avatarUrl || null,
  name: getMemberFullName(member),
  memberDivision: resolveMemberDivision(member),
  churchId: null,
  churchName: 'Iglesia desconocida',
  sectionalId: '',
  sectionalName: 'Sección desconocida',
  regionalId: '',
  regionalName: '',
  memberPosition: member.memberPosition || [],
  destLeadershipPosition: member.destLeadershipPosition || '',
  directivaLeadershipPosition: member.directivaLeadershipPosition || '',
  nationalLeadershipPosition: member.nationalLeadershipPosition || '',
});

export const mapMemberPhotoUrls = (memberPhotos) =>
  Object.fromEntries(
    Object.entries(memberPhotos || obtenerFotosPrincipalesEnCache({ tipoEntidad: 'miembro' }) || {})
      .filter(([, photo]) => photo?.urlFoto)
      .map(([memberId, photo]) => [String(memberId), photo.urlFoto])
  );

// ----------------------------------------------------------------------

export function applyFilter({ inputData, comparator, filters }) {
  const { name, memberDivision, memberPosition, sectionalId, destName } = filters;

  if (destName.length) {
    inputData = inputData.filter((member) => destName.includes(member.destId?.toString()));
  }

  if (memberDivision.length) {
    inputData = inputData.filter((member) => memberDivision.includes(member.memberDivision));
  }

  const stabilizedThis = inputData.map((el, index) => [el, index]);

  stabilizedThis.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });

  inputData = stabilizedThis.map((el) => el[0]);

  if (name) {
    inputData = inputData.filter((member) =>
      normalizeText(`${member.firstName || ''} ${member.lastName || ''}`).includes(
        normalizeText(name)
      )
    );
  }

  if (sectionalId.length) {
    inputData = inputData.filter((member) => sectionalId.includes(member.sectionalId?.toString()));
  }

  if (memberPosition?.length) {
    inputData = inputData.filter((member) => {
      const positions = [
        ...(member.memberPosition || []),
        member.destLeadershipPosition,
        member.directivaLeadershipPosition,
      ].filter(Boolean);

      return positions.some((role) => memberPosition.includes(role));
    });
  }

  return inputData;
}
