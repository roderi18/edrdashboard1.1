import { obtenerFotoPrincipal } from 'src/utils/firebase-photos';

import { getDestsApi } from './dest-service';
import { getChurches } from './church-service';
import { getMembers, getCachedMembers } from './member-service';
import { getRegionals } from './regional-service';
import { getSectionals } from './sectional-service';

const buildLookupMap = (items = [], keys = []) => {
  const map = new Map();

  items.forEach((item) => {
    keys.forEach((key) => {
      const value = item?.[key];

      if (value !== null && value !== undefined && value !== '') {
        map.set(String(value), item);
      }
    });
  });

  return map;
};

const findMemberByIdentifierInList = (members = [], identifier) =>
  members.find((member) =>
    [member?.id, member?.memberId, member?.codigoMiembro, member?.idMiembros].some(
      (value) => String(value || '') === String(identifier || '')
    )
  ) || null;

const buildMetadata = ({ dests = [], churches = [], regionals = [], sectionals = [] }) => ({
  dests,
  churches,
  regionals,
  sectionals,
  destById: buildLookupMap(dests, ['id', 'idDestacamento', 'destId']),
  churchById: buildLookupMap(churches, ['id', 'idIglesia', 'churchId']),
  regionalById: buildLookupMap(regionals, ['id', 'idRegion', 'regionId']),
  sectionalById: buildLookupMap(sectionals, ['id', 'idSeccion', 'sectionalId']),
});

let memberDirectoryMetadataPromise = null;

export async function getMemberDirectoryMetadata({
  refresh = false,
  includeDestPhotos = false,
  includeRegionalPhotos = false,
  includeSectionalPhotos = false,
} = {}) {
  if (!refresh && memberDirectoryMetadataPromise) {
    return memberDirectoryMetadataPromise;
  }

  memberDirectoryMetadataPromise = Promise.all([
    getDestsApi({ includePhotos: includeDestPhotos }),
    getChurches(),
    getRegionals({ includePhotos: includeRegionalPhotos }),
    getSectionals({ includePhotos: includeSectionalPhotos }),
  ]).then(([dests, churches, regionals, sectionals]) =>
    buildMetadata({ dests, churches, regionals, sectionals })
  );

  return memberDirectoryMetadataPromise;
}

export function findMemberByIdentifier(members, identifier) {
  return findMemberByIdentifierInList(members, identifier);
}

export function getCachedMemberByIdentifier(identifier) {
  return findMemberByIdentifierInList(getCachedMembers(), identifier);
}

export function resolveMemberWithMetadata(member, metadata = null) {
  if (!member) {
    return null;
  }

  if (!metadata) {
    return member;
  }

  const dest =
    metadata.destById.get(String(member?.idDestacamento || '')) ||
    metadata.destById.get(String(member?.destId || '')) ||
    null;
  const church =
    metadata.churchById.get(String(dest?.churchId || '')) ||
    metadata.churchById.get(String(dest?.idIglesia || '')) ||
    null;
  const sectional =
    metadata.sectionalById.get(String(church?.idSeccion || '')) ||
    metadata.sectionalById.get(String(church?.sectionId || '')) ||
    null;
  const regional =
    metadata.regionalById.get(String(sectional?.regionalId || '')) ||
    metadata.regionalById.get(String(sectional?.idRegion || '')) ||
    null;

  return {
    ...member,
    destId: member?.destId || member?.idDestacamento || '',
    churchId: church?.id || church?.idIglesia || dest?.churchId || null,
    churchName: church?.name || church?.churchName || 'Iglesia desconocida',
    sectionalId: sectional?.id || sectional?.idSeccion || '',
    sectionalName: sectional?.sectionalName || sectional?.nombre || '-',
    regionalId: regional?.id || regional?.idRegion || '',
    regionalName: regional?.regionalName || regional?.name || '-',
    destName: dest?.name || dest?.nombre || member?.destName || '',
    destNumber: dest?.destNumber || dest?.numero || '',
    destAvatarUrl: dest?.avatarUrl || '',
  };
}

export async function getResolvedMemberByIdentifier(
  identifier,
  { includePhoto = true, includeMetadata = false } = {}
) {
  const [members, metadata] = await Promise.all([
    getMembers(),
    includeMetadata ? getMemberDirectoryMetadata() : Promise.resolve(null),
  ]);
  const member = findMemberByIdentifierInList(members, identifier);

  if (!member) {
    return null;
  }

  const resolvedMember = resolveMemberWithMetadata(member, metadata);

  if (!includePhoto) {
    return resolvedMember;
  }

  const memberPhoto = await obtenerFotoPrincipal({
    tipoEntidad: 'miembro',
    idEntidad: member?.id,
  }).catch(() => null);

  return {
    ...resolvedMember,
    avatarUrl: memberPhoto?.urlFoto || resolvedMember?.avatarUrl || member?.avatarUrl || null,
  };
}
