import { fAdd, fSub, today } from 'src/utils/format-time';

import { _mock } from './_mock';

const createUser = (index) => ({
  id: _mock.id(index),
  name: _mock.fullName(index),
  avatarUrl: _mock.image.avatar(index),
});

const createComment = (index, message) => ({
  id: _mock.id(index),
  name: _mock.fullName(index),
  avatarUrl: _mock.image.avatar(index),
  message,
  messageType: 'text',
  createdAt: fSub({ days: index, hours: index }),
});

const createTask = ({
  id,
  status,
  name,
  description,
  priority = 'medium',
  labels = [],
  assignee = [],
  attachments = [],
  comments = [],
  due = [today(), fAdd({ days: 7 })],
  reporter = createUser(1),
}) => ({
  id,
  status,
  name,
  description,
  priority,
  labels,
  assignee,
  attachments,
  comments,
  due,
  reporter,
});

export const _kanban = {
  columns: [
    { id: 'backlog', name: 'Backlog' },
    { id: 'todo', name: 'To do' },
    { id: 'in-progress', name: 'In progress' },
    { id: 'review', name: 'Review' },
    { id: 'done', name: 'Done' },
  ],
  tasks: {
    backlog: [
      createTask({
        id: 'task-audit-members',
        status: 'Backlog',
        name: 'Revisar duplicados en lista de miembros',
        description:
          'Validar nombres, telefonos y codigos de usuario para limpiar registros repetidos antes del cierre semanal.',
        priority: 'high',
        labels: ['Miembros', 'Datos'],
        assignee: [createUser(2), createUser(3)],
        comments: [createComment(4, 'Pendiente confirmar el criterio final de duplicados.')],
        due: [today(), fAdd({ days: 3 })],
      }),
    ],
    todo: [
      createTask({
        id: 'task-product-mobile-filters',
        status: 'To do',
        name: 'Probar filtros mobile de productos',
        description:
          'Verificar que Existencias y Renglon solo aparezcan en mobile y que desktop conserve su flujo actual.',
        priority: 'medium',
        labels: ['Tienda', 'Mobile'],
        assignee: [createUser(6), createUser(7)],
        comments: [createComment(8, 'Revisar en ancho de 390px y tablet.')],
        due: [today(), fAdd({ days: 2 })],
      }),
    ],
    'in-progress': [
      createTask({
        id: 'task-admin-permissions',
        status: 'In progress',
        name: 'Pulir permisos de administradores',
        description:
          'Ajustar estados visuales y confirmar que las rutas internas mantengan activo el menu lateral.',
        priority: 'high',
        labels: ['Administradores', 'Permisos'],
        assignee: [createUser(9)],
        attachments: [_mock.image.cover(3)],
        due: [today(), fAdd({ days: 1 })],
      }),
    ],
    review: [
      createTask({
        id: 'task-sidebar-disabled',
        status: 'Review',
        name: 'Validar botones deshabilitados del sidebar',
        description:
          'Confirmar que Booking, Job y Tour se vean inhabilitados y no ejecuten navegacion.',
        priority: 'low',
        labels: ['Layout'],
        assignee: [createUser(10)],
        comments: [createComment(11, 'Listo para revisar con el usuario.')],
        due: [today(), fAdd({ days: 4 })],
      }),
    ],
    done: [
      createTask({
        id: 'task-search-language-disabled',
        status: 'Done',
        name: 'Deshabilitar comandos e idioma',
        description:
          'El boton de busqueda/comandos y el cambio de idioma quedan visibles, pero sin interaccion.',
        priority: 'low',
        labels: ['Header'],
        assignee: [createUser(12)],
        comments: [createComment(13, 'Atajo de teclado tambien deshabilitado.')],
        due: [fSub({ days: 1 }), today()],
      }),
    ],
  },
};
