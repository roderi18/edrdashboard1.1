import { _mock } from 'src/_mock';

// ----------------------------------------------------------------------

const rootNode = {
  group: 'root',
  role: 'Pastor',
  name: _mock.fullName(1),
  avatarUrl: _mock.image.avatar(1),
};

const group = {
  product: 'product design',
  development: 'development',
  marketing: 'marketing',
};

const createNode = (index, role, groupName, children) => ({
  id: _mock.id(index),
  name: _mock.fullName(index),
  avatarUrl: _mock.image.avatar(index),
  role,
  group: groupName,
  children,
});

// ----------------------------------------------------------------------

export const SIMPLE_DATA = {
  ...rootNode,
  children: [
    createNode(2, 'Coordinador de Destacamento', undefined, [
      createNode(3, 'Coordinador Asistente Destacamento', undefined, [
        createNode(4, 'Consejo Destacamento'),
        createNode(5, 'Capellán'),
      ]),
    ]),
  ],
};

export const LEADER_GROUP_DATA = [
  {
    id: _mock.id(14),
    name: 'Navegantes',
    role: '5 a 7 años',
    avatarUrl: '/logo/navegantes.png',
    isDivision: true,
    children: [createNode(6, 'Líder de Grupo', undefined, [createNode(10, 'Líder Asistente de Grupo')])],
  },
  {
    id: _mock.id(15),
    name: 'Pioneros',
    role: '8 a 10 años',
    avatarUrl: '/logo/pioneros.png',
    isDivision: true,
    children: [createNode(7, 'Líder de Grupo', undefined, [createNode(11, 'Líder Asistente de Grupo')])],
  },
  {
    id: _mock.id(16),
    name: 'Seguidores',
    role: '11 a 13 años',
    avatarUrl: '/logo/seguidores.png',
    isDivision: true,
    children: [createNode(8, 'Líder de Grupo', undefined, [createNode(12, 'Líder Asistente de Grupo')])],
  },
  {
    id: _mock.id(17),
    name: 'Exploradores',
    role: '14 a 17 años',
    avatarUrl: '/logo/exploradores.png',
    isDivision: true,
    children: [createNode(9, 'Líder de Grupo', undefined, [createNode(13, 'Líder Asistente de Grupo')])],
  },
];

// ----------------------------------------------------------------------

export const GROUP_DATA = {
  ...rootNode,
  children: [
    {
      name: group.product,
      group: group.product,
      children: [createNode(2, 'Lead', group.product, [createNode(3, 'Senior', group.product)])],
    },
    {
      name: group.development,
      group: group.development,
      children: [
        createNode(4, 'Lead', group.development, [
          createNode(5, 'Senior', group.development, [
            createNode(6, 'Back end developer', group.development, [
              createNode(7, 'Back end developer', group.development),
            ]),
            createNode(8, 'Front end', group.development),
          ]),
        ]),
      ],
    },
    {
      name: group.marketing,
      group: group.marketing,
      children: [
        createNode(9, 'Lead', group.marketing, [
          createNode(10, 'Lead', group.marketing),
          createNode(11, 'Content writer', group.marketing),
        ]),
      ],
    },
  ],
};
