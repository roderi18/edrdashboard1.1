// Los permisos con los que nace un miembro: ve la estructura de la organizacion
// y compra en la tienda, y no toca nada mas.
//
// Vive aparte de `member-access` —que arrastra el SDK de Firebase y el servicio
// de miembros— para que tambien lo pueda leer el servidor al crear la cuenta.
// `member-access` lo reexporta, asi que quien ya lo importaba de alli sigue
// igual.

export const buildDefaultMemberPermissions = () => ({
  miembros: {
    ver: true,
    crear: false,
    editar: false,
    eliminar: false,
    subirFoto: false,
  },
  destacamentos: {
    ver: true,
    crear: false,
    editar: false,
    eliminar: false,
  },
  // Los niveles organizacionales son de consulta para cualquier miembro: ve la
  // estructura, no la toca. Faltaban las dos claves, y sin ellas el menu ocultaba
  // Secciones, Regiones y Consejo Nacional.
  secciones: {
    ver: true,
    crear: false,
    editar: false,
    eliminar: false,
  },
  regiones: {
    ver: true,
    crear: false,
    editar: false,
    eliminar: false,
  },
  asistencia: {
    ver: false,
    crear: false,
    editar: false,
  },
  tienda: {
    ver: true,
    comprar: true,
    administrar: false,
    verPedidos: false,
    gestionarProductos: false,
  },
  ordenes: {
    ver: true,
  },
  recibos: {
    ver: true,
  },
  productos: {
    ver: true,
    crear: false,
    editar: false,
    eliminar: false,
  },
  blog: {
    ver: true,
  },
  course: {
    ver: true,
  },
  archivos: {
    ver: true,
  },
  chats: {
    ver: true,
  },
  calendario: {
    ver: true,
  },
  flujoTrabajo: {
    ver: true,
  },
});
