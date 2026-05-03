import { useMemo } from 'react';

import { today } from 'src/utils/format-time';

import { useMockedUser, useAuthContext } from 'src/auth/hooks';

// ----------------------------------------------------------------------

const normalizeText = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const findCurrentMemberContact = (contacts = [], user = {}) => {
  const idMiembros = user?.idMiembros ?? (Number.isFinite(Number(user?.memberId)) ? user?.memberId : null);

  if (idMiembros) {
    const byId = contacts.find((contact) => String(contact.idMiembros ?? contact.id) === String(idMiembros));

    if (byId) return byId;
  }

  const codigoMiembro = normalizeText(user?.codigoMiembro ?? user?.memberId ?? user?.codigoUsuario);

  if (codigoMiembro) {
    const byCode = contacts.find((contact) => normalizeText(contact.codigoMiembro) === codigoMiembro);

    if (byCode) return byCode;
  }

  const email = normalizeText(user?.correo ?? user?.email);

  if (email) {
    const byEmail = contacts.find((contact) => normalizeText(contact.correo ?? contact.email) === email);

    if (byEmail) return byEmail;
  }

  return null;
};

export function useChatCurrentContact(contacts = []) {
  const { user: authUser } = useAuthContext();
  const { user: mockedUser } = useMockedUser();

  return useMemo(() => {
    const user = authUser ?? mockedUser ?? {};
    const matchedContact = findCurrentMemberContact(contacts, user);
    const idMiembros = matchedContact?.idMiembros ?? user?.idMiembros ?? null;
    const id = idMiembros ? String(idMiembros) : String(matchedContact?.id ?? user?.id ?? '');
    const nombres =
      matchedContact?.nombres ??
      user?.nombres ??
      String(user?.displayName ?? '')
        .trim()
        .split(' ')[0] ??
      '';
    const apellidos =
      matchedContact?.apellidos ??
      user?.apellidos ??
      String(user?.displayName ?? '')
        .trim()
        .split(' ')
        .slice(1)
        .join(' ');
    const name =
      matchedContact?.name ??
      [nombres, apellidos].filter(Boolean).join(' ').trim() ??
      user?.displayName ??
      '';

    return {
      ...matchedContact,
      id,
      idMiembros: idMiembros ? Number(idMiembros) : null,
      codigoMiembro: matchedContact?.codigoMiembro ?? user?.codigoMiembro ?? user?.memberId ?? '',
      nombres,
      apellidos,
      name,
      role: matchedContact?.role ?? user?.role ?? user?.rol ?? 'miembro',
      email: matchedContact?.email ?? matchedContact?.correo ?? user?.email ?? user?.correo ?? '',
      correo: matchedContact?.correo ?? matchedContact?.email ?? user?.correo ?? user?.email ?? '',
      address: matchedContact?.address ?? matchedContact?.direccion ?? user?.address ?? '',
      direccion: matchedContact?.direccion ?? matchedContact?.address ?? user?.address ?? '',
      lastActivity: matchedContact?.lastActivity ?? today(),
      avatarUrl: matchedContact?.avatarUrl ?? user?.photoURL ?? '',
      phoneNumber: matchedContact?.phoneNumber ?? matchedContact?.telefono ?? user?.phoneNumber ?? '',
      telefono: matchedContact?.telefono ?? matchedContact?.phoneNumber ?? user?.phoneNumber ?? '',
      status: matchedContact?.status ?? 'online',
      estatusMiembro: matchedContact?.estatusMiembro ?? user?.estatusMiembro ?? 'activo',
    };
  }, [authUser, contacts, mockedUser]);
}
