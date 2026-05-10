const now = new Date();

const roderi = {
  name: 'Roderi Pena',
  email: 'rdpr18@gmail.com',
  avatarUrl: '/assets/images/avatar/avatar-25.webp',
};

export const _mailAccount = roderi;

const oliver = {
  name: 'Oliver Feliz',
  email: 'oliver.feliz@exploradores.app',
  avatarUrl: '/assets/images/avatar/avatar-5.webp',
};

const daniela = {
  name: 'Daniela Rosario',
  email: 'daniela.rosario@exploradores.app',
  avatarUrl: '/assets/images/avatar/avatar-12.webp',
};

export const _mailLabels = [
  {
    id: 'inbox',
    name: 'Entrada',
    type: 'system',
    color: '#00A76F',
    unreadCount: 2,
  },
  {
    id: 'sent',
    name: 'Enviados',
    type: 'system',
    color: '#078DEE',
    unreadCount: 0,
  },
  {
    id: 'starred',
    name: 'Destacados',
    type: 'system',
    color: '#FFAB00',
    unreadCount: 0,
  },
];

export const _mails = [
  {
    id: 'mail-conversacion-roderi-daniela-4',
    conversationId: 'conversacion-roderi-daniela',
    labelIds: ['inbox'],
    folder: 'inbox',
    from: daniela,
    to: [roderi],
    subject: 'Re: Confirmacion de actividad al aire libre',
    message: [
      'Hola Roderi,',
      '',
      'Gracias por la confirmacion. Ya actualice la lista con los responsables de hidratacion, seguridad y apoyo logistico.',
      '',
      'Tambien deje marcada la hora de llegada para las 7:30 a. m. y el punto de encuentro en la entrada principal del destacamento.',
    ].join('\n'),
    attachments: [],
    isUnread: true,
    isStarred: false,
    isImportant: true,
    createdAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'mail-conversacion-roderi-oliver-3',
    conversationId: 'conversacion-roderi-oliver',
    labelIds: ['inbox', 'starred'],
    folder: 'inbox',
    from: oliver,
    to: [roderi],
    subject: 'Re: Plan de documentos ministeriales',
    message: [
      'Hola Roderi,',
      '',
      'Perfecto, ya revise la estructura de carpetas que propusiste. Me parece bien separar los formularios por lideres, muchachos y recursos varios.',
      '',
      'Tambien sugiero dejar una carpeta visible para actividades al aire libre, porque sera de las mas consultadas.',
    ].join('\n'),
    attachments: [],
    isUnread: true,
    isStarred: true,
    isImportant: true,
    createdAt: new Date(now.getTime() - 8 * 60 * 1000).toISOString(),
  },
  {
    id: 'mail-conversacion-roderi-daniela-3',
    conversationId: 'conversacion-roderi-daniela',
    labelIds: ['sent'],
    folder: 'sent',
    from: roderi,
    to: [daniela],
    subject: 'Re: Confirmacion de actividad al aire libre',
    message:
      'Daniela, confirma por favor si los equipos ya estan asignados para la actividad del sabado.',
    attachments: [],
    isUnread: false,
    isStarred: false,
    isImportant: false,
    createdAt: new Date(now.getTime() - 16 * 60 * 1000).toISOString(),
  },
  {
    id: 'mail-conversacion-roderi-oliver-2',
    conversationId: 'conversacion-roderi-oliver',
    labelIds: ['sent'],
    folder: 'sent',
    from: roderi,
    to: [oliver],
    subject: 'Re: Plan de documentos ministeriales',
    message:
      'Oliver, por favor revisa si esta organizacion funciona para que los lideres puedan encontrar los documentos rapido.',
    attachments: [],
    isUnread: false,
    isStarred: false,
    isImportant: false,
    createdAt: new Date(now.getTime() - 22 * 60 * 1000).toISOString(),
  },
  {
    id: 'mail-conversacion-roderi-daniela-2',
    conversationId: 'conversacion-roderi-daniela',
    labelIds: ['inbox'],
    folder: 'inbox',
    from: daniela,
    to: [roderi],
    subject: 'Re: Confirmacion de actividad al aire libre',
    message:
      'Si, faltaba solo una persona para apoyo de registro, pero ya quedo cubierta. Te aviso si hay algun cambio.',
    attachments: [],
    isUnread: false,
    isStarred: false,
    isImportant: false,
    createdAt: new Date(now.getTime() - 35 * 60 * 1000).toISOString(),
  },
  {
    id: 'mail-conversacion-roderi-oliver-1',
    conversationId: 'conversacion-roderi-oliver',
    labelIds: ['inbox'],
    folder: 'inbox',
    from: oliver,
    to: [roderi],
    subject: 'Plan de documentos ministeriales',
    message:
      'Hola Roderi, te comparto una primera idea para ordenar los documentos ministeriales y validar si seguimos con esa linea.',
    attachments: [
      {
        id: 'mail-attachment-plan-documentos',
        name: 'borrador-organizacion-documentos.pdf',
        size: 128000,
        type: 'application/pdf',
        preview: '/assets/icons/files/ic-pdf.svg',
      },
    ],
    isUnread: false,
    isStarred: false,
    isImportant: false,
    createdAt: new Date(now.getTime() - 52 * 60 * 1000).toISOString(),
  },
  {
    id: 'mail-conversacion-roderi-daniela-1',
    conversationId: 'conversacion-roderi-daniela',
    labelIds: ['inbox'],
    folder: 'inbox',
    from: daniela,
    to: [roderi],
    subject: 'Confirmacion de actividad al aire libre',
    message:
      'Roderi, te envio la primera version de la coordinacion para la actividad al aire libre. Quedo pendiente a tus observaciones.',
    attachments: [
      {
        id: 'mail-attachment-actividad-aire-libre',
        name: 'plan-actividad-aire-libre.pdf',
        size: 164000,
        type: 'application/pdf',
        preview: '/assets/icons/files/ic-pdf.svg',
      },
    ],
    isUnread: false,
    isStarred: false,
    isImportant: false,
    createdAt: new Date(now.getTime() - 78 * 60 * 1000).toISOString(),
  },
];
