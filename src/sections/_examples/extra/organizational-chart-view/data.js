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
