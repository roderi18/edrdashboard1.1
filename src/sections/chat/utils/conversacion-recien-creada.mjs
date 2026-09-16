export function crearConversacionOptimista({ conversacion, mensaje, texto } = {}) {
  return {
    ...conversacion,
    messages: [
      {
        ...mensaje,
        body: texto,
        estadoEnvio: 'enviando',
      },
    ],
  };
}

export function resolverConversacionVisible({
  conversacionDelServidor,
  conversacionRecienCreada,
  idConversacionSeleccionada,
  cargando,
} = {}) {
  const coincideConLaRuta =
    idConversacionSeleccionada &&
    conversacionRecienCreada?.id &&
    String(conversacionRecienCreada.id) === String(idConversacionSeleccionada);

  const conversacion =
    conversacionDelServidor || (coincideConLaRuta ? conversacionRecienCreada : undefined);

  return {
    conversacion,
    cargando: Boolean(cargando && !conversacion),
  };
}
