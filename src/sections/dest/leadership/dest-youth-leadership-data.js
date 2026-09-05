// ----------------------------------------------------------------------
// EL ORGANIGRAMA DE LIDERES JUVENILES DEL DESTACAMENTO.
//
// Es la parte de abajo de la Directiva Local: donde esta termina en el Lider de
// Grupo de cada division, esta sigue con el equipo que ese lider dirige. Por eso
// el Lider de Grupo y su Asistente son LOS MISMOS cargos que ya usa la Directiva
// Local (mismo `cargo`, misma `division`, mismo `orden`): quien este puesto alla
// aparece puesto aqui, porque es la misma persona en el mismo puesto.
//
// Hay UN cuadro por division y se ve de uno en uno, elegido con el desplegable.
// Dibujar los cuatro a la vez no cabe: cada uno tiene dieciseis casillas.
//
// El "Equipo de Liderazgo de Grupo" del documento oficial NO esta aqui: es un
// recuadro que agrupa visualmente al Guia Mayor con su equipo, no un cargo que
// nadie ocupe. Se dibuja como guia en la pantalla, no como nodo del arbol.
//
// `asignacionOrganigrama` es lo que casa el nodo con su asignacion guardada
// (cargo + division + orden). El `orden` importa de verdad aqui: hay dos
// Lideres Asistentes y tres Guias de Patrulla, y es lo unico que los distingue
// entre si.
// ----------------------------------------------------------------------

// Las mismas cuatro y en el mismo orden que la Directiva Local y el listado de
// miembros: de la division mayor a la menor.
export const DIVISIONES_JUVENILES = [
  { id: 'exploradores', nombre: 'Exploradores', edades: '14 a 17 años' },
  { id: 'seguidores', nombre: 'Seguidores', edades: '11 a 13 años' },
  { id: 'pioneros', nombre: 'Pioneros', edades: '8 a 10 años' },
  { id: 'navegantes', nombre: 'Navegantes', edades: '5 a 7 años' },
];

// Cuantas casillas hay de los cargos que se repiten.
export const ASISTENTES_DE_GRUPO = 2;
export const PATRULLAS = 3;

const nodo = ({ id, role, cargo, division, orden = 1, children }) => ({
  id,
  role,
  children,
  asignacionOrganigrama: { cargo, division, orden },
});

// EL ORDEN IMPORTA: el cuadro dibuja a los hijos en fila, de izquierda a
// derecha, en el orden en que se declaran. En el documento oficial la fila de
// arriba es "Guia Mayor Auxiliar" y las tres patrullas, y el resto del equipo
// baja por una columna a la izquierda. Por eso el Auxiliar va primero, las
// patrullas justo detras y la columna al final: asi la fila de arriba sale ya
// en su sitio y lo unico que queda por colocar es esa columna.
const GUIA_MAYOR_AUXILIAR = {
  sufijo: 'guia-mayor-auxiliar',
  role: 'Guía Mayor Auxiliar',
  cargo: 'guia_mayor_auxiliar',
};

// Los que en el documento cuelgan de la barra vertical de la izquierda.
const COLUMNA_DEL_GUIA_MAYOR = [
  {
    sufijo: 'especialista-comunicaciones',
    role: 'Especialista de Comunicaciones',
    cargo: 'especialista_comunicaciones',
  },
  { sufijo: 'supervisor-equipo', role: 'Supervisor de Equipo', cargo: 'supervisor_equipo' },
  { sufijo: 'historiador', role: 'Historiador', cargo: 'historiador' },
  { sufijo: 'capellan-auxiliar', role: 'Capellán Auxiliar', cargo: 'capellan_auxiliar' },
];

const EQUIPO_DEL_GUIA_MAYOR = [GUIA_MAYOR_AUXILIAR, ...COLUMNA_DEL_GUIA_MAYOR];

// Los ids del Guia Mayor y de su equipo. Se marcan aparte porque la pantalla
// dibuja el recuadro "Equipo de Liderazgo de Grupo" alrededor de ellos.
export const idsDelEquipoDeLiderazgo = (division) => [
  `guia-mayor-${division}`,
  ...EQUIPO_DEL_GUIA_MAYOR.map(({ sufijo }) => `${sufijo}-${division}`),
  ...Array.from({ length: PATRULLAS }, (_, i) => `guia-patrulla-${i + 1}-${division}`),
];

export const construirArbolJuvenil = (division) =>
  nodo({
    id: `lider-grupo-${division}`,
    role: 'Líder de Grupo',
    cargo: 'lider_grupo',
    division,
    children: [
      // Dos asistentes: el `orden` es lo unico que los separa. El PRIMERO se
      // llama como en la Directiva Local —sin numero— porque es el mismo nodo
      // del catalogo; ponerle un "1" lo dejaria sin cargo que lo respalde.
      ...Array.from({ length: ASISTENTES_DE_GRUPO }, (_, indice) =>
        nodo({
          id:
            indice === 0
              ? `lider-asistente-grupo-${division}`
              : `lider-asistente-grupo-${indice + 1}-${division}`,
          role: 'Líder Asistente de Grupo',
          cargo: 'lider_asistente_grupo',
          division,
          orden: indice + 1,
        })
      ),
      nodo({
        id: `lider-juvenil-grupo-${division}`,
        role: 'Líder Juvenil de Grupo',
        cargo: 'lider_juvenil_grupo',
        division,
      }),
      nodo({
        id: `guia-mayor-${division}`,
        role: 'Guía Mayor',
        cargo: 'guia_mayor',
        division,
        children: [
          // Fila de arriba: el Auxiliar y, detras, las tres patrullas.
          nodo({
            id: `${GUIA_MAYOR_AUXILIAR.sufijo}-${division}`,
            role: GUIA_MAYOR_AUXILIAR.role,
            cargo: GUIA_MAYOR_AUXILIAR.cargo,
            division,
          }),
          // Cada patrulla lleva su auxiliar debajo.
          ...Array.from({ length: PATRULLAS }, (_, indice) =>
            nodo({
              id: `guia-patrulla-${indice + 1}-${division}`,
              role: 'Guía de Patrulla',
              cargo: 'guia_patrulla',
              division,
              orden: indice + 1,
              children: [
                nodo({
                  id: `guia-auxiliar-patrulla-${indice + 1}-${division}`,
                  role: 'Guía Auxiliar de Patrulla',
                  cargo: 'guia_auxiliar_patrulla',
                  division,
                  orden: indice + 1,
                }),
              ],
            })
          ),
          // Y despues la columna, que es lo que el diseno baja a la izquierda.
          ...COLUMNA_DEL_GUIA_MAYOR.map(({ sufijo, role, cargo }) =>
            nodo({ id: `${sufijo}-${division}`, role, cargo, division })
          ),
        ],
      }),
    ],
  });

// El cuadro de cada division, listo para pintar.
export const ARBOLES_JUVENILES_POR_DIVISION = DIVISIONES_JUVENILES.reduce(
  (acc, division) => ({ ...acc, [division.id]: construirArbolJuvenil(division.id) }),
  {}
);
