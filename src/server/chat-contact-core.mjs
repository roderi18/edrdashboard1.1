const toMemberId = (value) => {
  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const cleanText = (value) => String(value ?? '').trim();

export const toPublicChatContact = (member = {}) => {
  const idMiembros = toMemberId(member.idMiembros ?? member.id ?? member.memberId);
  const nombres = cleanText(member.nombres ?? member.firstName ?? member.nombre);
  const apellidos = cleanText(member.apellidos ?? member.lastName);
  const name =
    cleanText(member.name ?? member.displayName) ||
    [nombres, apellidos].filter(Boolean).join(' ') ||
    cleanText(member.codigoMiembro ?? member.memberId) ||
    (idMiembros ? `Miembro ${idMiembros}` : 'Miembro');

  return {
    id: idMiembros ? String(idMiembros) : '',
    idMiembros,
    codigoMiembro: cleanText(member.codigoMiembro ?? member.memberId),
    nombres,
    apellidos,
    name,
    avatarUrl: cleanText(member.avatarUrl ?? member.photoURL),
    status: cleanText(member.status) || 'offline',
  };
};

export const getPublicChatContacts = (members = []) => {
  const contacts = new Map();

  members.forEach((member) => {
    const contact = toPublicChatContact(member);

    if (!contact.id) return;

    const current = contacts.get(contact.id);

    contacts.set(
      contact.id,
      current
        ? {
            ...contact,
            ...current,
            avatarUrl: current.avatarUrl || contact.avatarUrl,
          }
        : contact
    );
  });

  return Array.from(contacts.values());
};
