import { obtenerFotoPrincipal } from 'src/utils/firebase-photos';

import { getDestsApi } from './dest-service';
import { getChurches } from './church-service';
import { getRegionals } from './regional-service';
import { getSectionals } from './sectional-service';
import { getMembers, getCachedMembers } from './member-service';

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
const resolvedMemberCache = new Map();

// La foto del destacamento SI, por defecto.
//
// La fila de cada miembro pinta el avatar de su destacamento, asi que sin ella
// el listado sale lleno de iconos grises. Cuesta una consulta a `fotos` con un
// puñado de documentos, y ademas la promesa esta cacheada: la paga la primera
// pantalla que cargue y el resto la reutiliza.
//
// Justo por esa cache el valor tiene que decidirse AQUI y no en cada llamada:
// quien llamara primero mandaba sobre todos los demas, asi que bastaba con
// entrar por una pantalla que no quisiera fotos para que el listado de miembros
// se quedara sin ellas.
export async function getMemberDirectoryMetadata({
  refresh = false,
  includeDestPhotos = true,
  includeRegionalPhotos = false,
  includeSectionalPhotos = false,
} = {}) {
  if (!refresh && memberDirectoryMetadataPromise) {
    return memberDirectoryMetadataPromise;
  }

  const enCurso = Promise.all([
    getDestsApi({ includePhotos: includeDestPhotos }),
    getChurches(),
    getRegionals({ includePhotos: includeRegionalPhotos }),
    getSectionals({ includePhotos: includeSectionalPhotos }),
  ]).then(([dests, churches, regionals, sectionals]) =>
    buildMetadata({ dests, churches, regionals, sectionals })
  );

  memberDirectoryMetadataPromise = enCurso;

  // UNA PROMESA ROTA NO SE QUEDA CACHEADA.
  //
  // Al guardar el rechazo, el primer fallo de la estructura dejaba clavadas
  // TODAS las pestañas del miembro: cada navegacion volvia a leer la misma
  // promesa rota y solo recargando la pagina entera —modulo nuevo, cache
  // vacia— se reintentaba. Es lo mismo que ya hacen miembros y divisiones.
  //
  // La comparacion evita pisar una recarga mas nueva que ya este en vuelo.
  enCurso.catch(() => {
    if (memberDirectoryMetadataPromise === enCurso) {
      memberDirectoryMetadataPromise = null;
    }
  });

  return enCurso;
}

export function findMemberByIdentifier(members, identifier) {
  return findMemberByIdentifierInList(members, identifier);
}

export function getCachedMemberByIdentifier(identifier) {
  return findMemberByIdentifierInList(getCachedMembers(), identifier);
}

export function getCachedResolvedMemberByIdentifier(
  identifier,
  { includePhoto = true, includeMetadata = true } = {}
) {
  return resolvedMemberCache.get(
    resolvedMemberCacheKey(identifier, includePhoto, includeMetadata)
  ) || null;
}

const resolvedMemberCacheKey = (identifier, includePhoto, includeMetadata) =>
  `${String(identifier ?? '')}:${includePhoto ? 'photo' : 'no-photo'}:${includeMetadata ? 'metadata' : 'no-metadata'}`;

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
  const cacheKey = resolvedMemberCacheKey(identifier, includePhoto, includeMetadata);
  const cached = resolvedMemberCache.get(cacheKey);

  if (cached) {
    // Devuelve la ficha ya conocida y refresca silenciosamente para la próxima
    // visita. El tab no vuelve a mostrar skeleton por esperar la red.
    void loadResolvedMember(identifier, { includePhoto, includeMetadata })
      .then((fresh) => {
        if (fresh) resolvedMemberCache.set(cacheKey, fresh);
      })
      // El refresco es de cortesia: si falla, se sigue con la ficha cacheada.
      // Sin este catch el rechazo quedaba sin dueño y Next lo pintaba encima de
      // la pestaña ya cargada.
      .catch(() => {});

    return cached;
  }

  const resolved = await loadResolvedMember(identifier, { includePhoto, includeMetadata });

  if (resolved) resolvedMemberCache.set(cacheKey, resolved);

  return resolved;
}

async function loadResolvedMember(identifier, { includePhoto, includeMetadata }) {
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

export function clearResolvedMemberCache() {
  resolvedMemberCache.clear();
}
