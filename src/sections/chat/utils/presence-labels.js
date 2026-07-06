// ----------------------------------------------------------------------
// Vocabulario de estados de presencia. Los valores ('online' | 'always' | 'busy' | 'offline')
// coinciden con las variantes ya soportadas por el Badge del tema
// (src/theme/core/components/badge.jsx) para no tener que tocar el theme.
// 'always' se reetiqueta como "Ausente" (away) solo a nivel de texto visible.

export const PRESENCE_LABELS = {
  online: 'En línea',
  always: 'Ausente',
  busy: 'Ocupado',
  offline: 'Desconectado',
};

// Opciones que el usuario puede elegir manualmente. "Desconectado" (offline) NO
// se incluye: ese estado solo se asigna automáticamente por inactividad/staleness.
export const PRESENCE_STATUS_OPTIONS = [
  { value: 'online', label: PRESENCE_LABELS.online },
  { value: 'always', label: PRESENCE_LABELS.always },
  { value: 'busy', label: PRESENCE_LABELS.busy },
];
