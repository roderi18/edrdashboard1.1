import { _mails, _mailLabels } from 'src/_mock/_mail';

export async function GET() {
  const labels = _mailLabels.map((label) => ({
    ...label,
    unreadCount: _mails.filter((mail) => mail.isUnread && mail.labelIds.includes(label.id)).length,
  }));

  return Response.json({ labels });
}
