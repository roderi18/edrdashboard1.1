export const DIRECTIVA_LEVELS = {
  nacional: 'nacional',
  regional: 'regional',
  seccional: 'seccional',
  destacamento: 'destacamento',
};

export const DIRECTIVA_DIVISIONS = {
  navegantes: 'navegantes',
  pioneros: 'pioneros',
  seguidores: 'seguidores',
  exploradores: 'exploradores',
};

export const NATIONAL_LEADERSHIP_LEVELS = [
  { value: 'none', label: 'Ninguna' },
  { value: DIRECTIVA_LEVELS.nacional, label: 'Nivel Nacional' },
  { value: DIRECTIVA_LEVELS.regional, label: 'Nivel Regional' },
  { value: DIRECTIVA_LEVELS.seccional, label: 'Nivel Seccional' },
];
