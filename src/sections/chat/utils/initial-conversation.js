import { uuidv4 } from 'minimal-shared/utils';

import { fSub } from 'src/utils/format-time';

import { resolveMentionIds } from './productivity.mjs';

// ----------------------------------------------------------------------

export function initialConversation({
  message = '',
  recipients,
  me,
  replyMessage = null,
  groupName = '',
}) {
  const isGroup = recipients.length > 1;
  const participants = [...recipients, me];

  const messageData = {
    id: uuidv4(),
    attachments: [],
    body: message,
    contentType: 'text',
    createdAt: fSub({ minutes: 1 }),
    senderId: me.idMiembros ? String(me.idMiembros) : me.id,
    mentionIds: resolveMentionIds(message, participants),
    replyTo: replyMessage
      ? {
          id: replyMessage.id,
          body: replyMessage.body,
          senderId: replyMessage.senderId,
        }
      : null,
  };

  const conversationData = {
    id: isGroup ? uuidv4() : recipients[0]?.id,
    messages: [messageData],
    participants,
    type: isGroup ? 'GROUP' : 'ONE_TO_ONE',
    groupName: isGroup ? groupName || null : null,
    unreadCount: 0,
  };

  return { messageData, conversationData };
}
