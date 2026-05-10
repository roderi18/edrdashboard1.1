import { _mails } from 'src/_mock/_mail';

const getMailWithThread = (mailId) => {
  const selectedMail = _mails.find((item) => item.id === mailId) || null;
  const thread = selectedMail
    ? _mails
        .filter((item) => item.conversationId === selectedMail.conversationId)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    : [];

  return selectedMail ? { ...selectedMail, thread } : null;
};

const syncLabel = (mail, labelId, enabled) => {
  const labelIds = new Set(mail.labelIds || []);

  if (enabled) {
    labelIds.add(labelId);
  } else {
    labelIds.delete(labelId);
  }

  return Array.from(labelIds);
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mail = getMailWithThread(searchParams.get('mailId'));

  return Response.json({ mail });
}

export async function PATCH(request) {
  const { searchParams } = new URL(request.url);
  const mailId = searchParams.get('mailId');
  const mailIndex = _mails.findIndex((item) => item.id === mailId);

  if (mailIndex === -1) {
    return Response.json({ message: 'Correo no encontrado.' }, { status: 404 });
  }

  const updates = await request.json();
  const currentMail = _mails[mailIndex];
  const nextMail = {
    ...currentMail,
    ...updates,
  };

  if (Object.prototype.hasOwnProperty.call(updates, 'isStarred')) {
    nextMail.labelIds = syncLabel(nextMail, 'starred', updates.isStarred);
  }

  _mails[mailIndex] = nextMail;

  return Response.json({ mail: getMailWithThread(mailId) });
}
