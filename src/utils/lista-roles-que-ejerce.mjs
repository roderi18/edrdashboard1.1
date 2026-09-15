// ----------------------------------------------------------------------
// TODOS LOS CARGOS QUE EJERCE UNA CUENTA, EN UNA LISTA PLANA.
//
// `usuarios_roles/<uid>` guarda el cargo principal en `rolId` y los demas dentro
// de `cargos`, una lista de objetos. La aplicacion y el servidor ya preguntan por
// todos (`rolesQueEjerce`), pero las reglas de Firestore no pueden buscar dentro
// de una lista de objetos: solo miraban `rolId`. Quien tenia la Oficina Nacional
// en cualquier posicion que no fuera la principal —segunda, tercera, cuarta...—
// atendia su buzon en la pantalla y las reglas no le dejaban escucharlo en
// tiempo real. La lista lleva TODOS, sin limite ni orden que importe.
//
// Esta lista se guarda junto al resto, como `rolesQueEjerce`, cada vez que el
// servidor escribe los cargos; las reglas la consultan con `hasAny`.
// ----------------------------------------------------------------------

const codigo = (valor) =>
  String(valor ?? '')
    .trim()
    .toLowerCase();

export const listaDeRolesQueEjerce = ({ rolId = '', cargos = [] } = {}) => [
  ...new Set(
    [
      codigo(rolId),
      ...(Array.isArray(cargos) ? cargos : []).map((cargo) =>
        codigo(typeof cargo === 'string' ? cargo : (cargo?.rol ?? cargo?.rolId ?? cargo?.codigo))
      ),
    ].filter(Boolean)
  ),
];
