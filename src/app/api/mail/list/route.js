import { _mails, _mailAccount } from 'src/_mock/_mail';

const getReplySubject = (subject = '') =>
  String(subject).toLowerCase().startsWith('re:') ? subject : `Re: ${subject}`;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const labelId = searchParams.get('labelId');

  const mails =
    labelId && labelId !== 'all'
      ? _mails.filter((mail) => mail.labelIds.includes(labelId))
      : _mails;

  return Response.json({
    mails: [...mails].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  });
}

export async function POST(request) {
  const mailData = await request.json();
  const sourceMail = mailData.sourceMailId
    ? _mails.find((mail) => mail.id === mailData.sourceMailId)
    : null;
  const createdAt = new Date().toISOString();
  const mail = {
    id: `mail-${crypto.randomUUID()}`,
    conversationId: sourceMail?.conversationId || `conversacion-${crypto.randomUUID()}`,
    labelIds: ['sent'],
    folder: 'sent',
    from: _mailAccount,
    to: mailData.to?.length ? mailData.to : [sourceMail?.from].filter(Boolean),
    subject: mailData.subject || (sourceMail ? getReplySubject(sourceMail.subject) : 'Sin asunto'),
    message: mailData.message || '',
    attachments: mailData.attachments || [],
    isUnread: false,
    isStarred: false,
    isImportant: false,
    createdAt,
  };

  _mails.unshift(mail);

  return Response.json({ mail });
}
