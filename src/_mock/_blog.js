export const POST_PUBLISH_OPTIONS = [
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
];

export const POST_SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'popular', label: 'Popular' },
  { value: 'oldest', label: 'Oldest' },
];

export const _posts = [
  {
    id: 'post-exploradores-001',
    title: 'Actividades al aire libre para exploradores',
    description:
      'Ideas practicas para organizar una actividad segura, divertida y bien preparada con los muchachos.',
    content: `
## Actividades al aire libre

Una buena actividad al aire libre combina seguridad, preparacion y proposito. Antes de salir, confirma la lista de participantes, el clima, los responsables, los materiales y los contactos de emergencia.

Tambien conviene preparar una pequena charla de cierre para conectar la experiencia con el aprendizaje del grupo.

## Objetivo de la actividad

El objetivo principal es que cada explorador pueda participar en una experiencia practica donde aprenda trabajo en equipo, disciplina, observacion y servicio. La actividad puede incluir caminata, orientacion, juegos por estaciones, aprendizaje de nudos, primeros auxilios basicos y una reflexion final.

## Lista rapida de preparacion

- Confirmar permisos y asistencia.
- Revisar botiquin y contactos de emergencia.
- Asignar responsables por grupo.
- Llevar agua suficiente y materiales de apoyo.
- Definir hora de salida, retorno y punto de reunion.

## Nota para lideres

Este texto es solo de prueba para validar como se ve el contenido dentro del detalle del post. Luego puede reemplazarse por una publicacion real con imagenes, instrucciones y recursos descargables.
`,
    coverUrl: '/assets/images/mock/cover/cover-1.webp',
    publish: 'published',
    tags: ['Exploradores', 'Actividades', 'Aire libre'],
    createdAt: '2026-05-08T09:00:00.000Z',
    totalViews: 128,
    totalShares: 12,
    totalComments: 3,
    totalFavorites: 24,
    author: {
      name: 'Roderi Pena',
      avatarUrl: '/assets/images/mock/avatar/avatar-1.webp',
    },
    favoritePerson: [
      { name: 'Oliver Feliz', avatarUrl: '/assets/images/mock/avatar/avatar-2.webp' },
      { name: 'Usuario Prueba', avatarUrl: '/assets/images/mock/avatar/avatar-3.webp' },
    ],
    comments: [
      {
        id: 'comment-001',
        name: 'Oliver Feliz',
        avatarUrl: '/assets/images/mock/avatar/avatar-2.webp',
        message: 'Excelente guia para planificar la actividad.',
        postedAt: '2026-05-08T10:00:00.000Z',
        users: [
          {
            id: 'user-001',
            name: 'Roderi Pena',
            avatarUrl: '/assets/images/mock/avatar/avatar-1.webp',
          },
        ],
        replyComment: [
          {
            id: 'reply-001',
            userId: 'user-001',
            message: 'Gracias, esta respuesta es solo para probar el hilo de comentarios.',
            postedAt: '2026-05-08T10:15:00.000Z',
            tagUser: 'Oliver Feliz',
          },
        ],
      },
    ],
  },
];
