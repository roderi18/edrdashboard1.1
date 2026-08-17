// ----------------------------------------------------------------------
// Estructura del organigrama del destacamento.
//
// Antes se leia de `src/sections/_examples/.../data`, la demo de la plantilla,
// que rellena cada nodo con `_mock.fullName()` y una foto de `_mock.image`: un
// cargo SIN ocupante mostraba el nombre y la cara de una persona inventada. Aqui
// el nodo solo describe el CARGO; el nombre y la foto los pone el ocupante real,
// y si no hay ocupante se dibuja como vacante.
//
// `asignacionOrganigrama` es lo que casa el nodo con su asignacion guardada
// (cargo + division + orden); los ids son estables porque el editor visual
// guarda los desplazamientos por id.
// ----------------------------------------------------------------------

const DIVISIONES = [
  { id: 'navegantes', nombre: 'Navegantes', edades: '5 a 7 años' },
  { id: 'pioneros', nombre: 'Pioneros', edades: '8 a 10 años' },
  { id: 'seguidores', nombre: 'Seguidores', edades: '11 a 13 años' },
  { id: 'exploradores', nombre: 'Exploradores', edades: '14 a 17 años' },
];

const createNode = ({ id, role, cargo, division = null, orden = 1, children }) => ({
  id,
  role,
  children,
  asignacionOrganigrama: { cargo, division, orden },
});

export const DEST_LEADERSHIP_DATA = createNode({
  id: 'pastor',
  role: 'Pastor',
  cargo: 'pastor',
  children: [
    createNode({
      id: 'coordinador-destacamento',
      role: 'Coordinador de Destacamento',
      cargo: 'coordinador_destacamento',
      children: [
        createNode({
          id: 'coordinador-asistente-destacamento',
          role: 'Coordinador Asistente Destacamento',
          cargo: 'coordinador_asistente_destacamento',
          children: [
            createNode({
              id: 'consejo-destacamento',
              role: 'Consejo Destacamento',
              cargo: 'consejo_destacamento',
            }),
            createNode({
              id: 'capellan-destacamento',
              role: 'Capellán',
              cargo: 'capellan',
            }),
          ],
        }),
      ],
    }),
  ],
});

// Las divisiones NO son cargos: son la franja de edad del grupo, con su logo.
// No tienen ocupante, no se asignan y no se marcan como vacantes; de ellas
// cuelgan los cargos que si lo son.
export const DEST_DIVISION_GROUPS = DIVISIONES.map((division) => ({
  id: `division-${division.id}`,
  name: division.nombre,
  role: division.edades,
  avatarUrl: `/logo/${division.id}.png`,
  isDivision: true,
  children: [
    createNode({
      id: `lider-grupo-${division.id}`,
      role: 'Líder de Grupo',
      cargo: 'lider_grupo',
      division: division.id,
      children: [
        createNode({
          id: `lider-asistente-grupo-${division.id}`,
          role: 'Líder Asistente de Grupo',
          cargo: 'lider_asistente_grupo',
          division: division.id,
        }),
      ],
    }),
  ],
}));
