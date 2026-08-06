const MEMBER_AUTH_DOMAIN = 'exploradores.app';
const MEMBERS_API_URL = 'https://systexploradores.somee.com/api/Miembros/GetAllMiembros';
const MEMBER_DIRECTORY_CACHE_TTL_MS = 30_000;

let memberDirectoryPromise = null;
let memberDirectoryExpiresAt = 0;

const asArray = (value) => (Array.isArray(value) ? value : []);
const normalizeEmail = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();
const normalizeCode = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');
const positiveMemberId = (value) => {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const addIdentityEmail = (keys, value) => {
  const email = normalizeEmail(value);
  if (!email) return;

  keys.add(`email:${email}`);
  const [localPart, domain] = email.split('@');
  if (localPart && domain === MEMBER_AUTH_DOMAIN) keys.add(`code:${normalizeCode(localPart)}`);
};

const buildVerifiedIdentityKeys = ({ decodedToken = {}, profiles = [] } = {}) => {
  const keys = new Set();

  addIdentityEmail(keys, decodedToken.email);
  asArray(profiles).forEach((profile) => {
    addIdentityEmail(keys, profile?.correo ?? profile?.email);
    [profile?.codigoMiembro, profile?.codigoUsuario, profile?.username]
      .map(normalizeCode)
      .filter(Boolean)
      .forEach((code) => keys.add(`code:${code}`));
  });

  return keys;
};

const buildMemberKeys = (member = {}) => {
  const keys = new Set();
  const memberCode = normalizeCode(
    member.codigoMiembro ?? member.memberId ?? member.codigoUsuario ?? member.username
  );
  const email = normalizeEmail(member.correo ?? member.email);

  if (memberCode) keys.add(`code:${memberCode}`);
  if (email) keys.add(`email:${email}`);

  return keys;
};

export const getMemberRowsFromDirectoryPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.Data)) return payload.Data;
  if (Array.isArray(payload?.items)) return payload.items;

  return [];
};

export const getChatMemberDirectory = async ({ fetchImpl = fetch, useCache = true } = {}) => {
  const now = Date.now();

  if (!useCache || !memberDirectoryPromise || memberDirectoryExpiresAt <= now) {
    memberDirectoryExpiresAt = now + MEMBER_DIRECTORY_CACHE_TTL_MS;
    memberDirectoryPromise = (async () => {
      const response = await fetchImpl(MEMBERS_API_URL, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        throw new Error(`El directorio de miembros respondió HTTP ${response.status}.`);
      }

      return getMemberRowsFromDirectoryPayload(await response.json());
    })().catch((error) => {
      memberDirectoryPromise = null;
      memberDirectoryExpiresAt = 0;
      throw error;
    });
  }

  return memberDirectoryPromise;
};

export const resolveDirectoryIdentityProfiles = ({
  decodedToken = {},
  profiles = [],
  members = [],
} = {}) => {
  const identityKeys = buildVerifiedIdentityKeys({ decodedToken, profiles });
  if (!identityKeys.size) return [];

  const matchesById = new Map();

  asArray(members).forEach((member) => {
    const idMiembros = positiveMemberId(member?.idMiembros ?? member?.id);
    if (!idMiembros) return;

    const isMatch = [...buildMemberKeys(member)].some((key) => identityKeys.has(key));
    if (!isMatch || matchesById.has(idMiembros)) return;

    matchesById.set(idMiembros, {
      collection: 'member-directory',
      id: String(idMiembros),
      idMiembros,
      codigoMiembro:
        member.codigoMiembro ?? member.memberId ?? member.codigoUsuario ?? member.username ?? '',
      correo: member.correo ?? member.email ?? '',
      nombre:
        member.nombre ??
        member.name ??
        [member.nombres ?? member.firstName, member.apellidos ?? member.lastName]
          .filter(Boolean)
          .join(' ')
          .trim(),
      estado: member.estatusMiembro ?? member.estado ?? member.status ?? 'activo',
    });
  });

  return [...matchesById.values()];
};
