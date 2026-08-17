// Edad del miembro. Vive en su propio modulo (y no en member-access) para que
// quien solo necesite calcular la edad no arrastre Firebase ni el catalogo de
// permisos: es una funcion pura y se usa desde utilidades sin dependencias.

// Edad a partir de la cual un miembro deja de considerarse menor de edad. El
// enmascarado de la ficha existe para proteger a los MENORES.
export const EDAD_MAYORIA = 18;

// Edad del miembro a partir de su fecha de nacimiento (null si no la tiene).
export const getMemberAge = (member = {}) => {
  const birthDate =
    member?.birthDate ?? member?.fechaNacimiento ?? member?.birth ?? member?.dateOfBirth;

  if (!birthDate) return null;

  const parsed = new Date(birthDate);

  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }

  return age;
};
