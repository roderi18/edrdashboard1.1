export const MEMBER_COUNTRIES = [
  { code: 'DO', label: 'República Dominicana' },
  { code: 'PR', label: 'Puerto Rico' },
  { code: 'MX', label: 'Mexico' },
  { code: 'CO', label: 'Colombia' },
  { code: 'AR', label: 'Argentina' },
];

export const MEMBER_GENDERS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
];

export const MEMBER_SHIRT_SIZES = [
  { value: '6', label: '6' },
  { value: '8', label: '8' },
  { value: '10', label: '10' },
  { value: '12', label: '12' },
  { value: '14', label: '14' },
  { value: '16', label: '16' },
  { value: 'S', label: 'S' },
  { value: 'M', label: 'M' },
  { value: 'L', label: 'L' },
  { value: 'XL', label: 'XL' },
  { value: 'XXL', label: 'XXL' },
];

// Los `value` que ya existian NO se tocan: es lo que hay guardado en las fichas.
// Se muestran ordenados alfabeticamente (MEMBER_OCUPATIONS_SORTED), asi que el
// orden de esta lista solo importa para leerla.
export const MEMBER_OCUPATIONS = [
  { value: 'software_engineer', label: 'Ing. Software' },
  { value: 'teacher', label: 'Profesor' },
  { value: 'student', label: 'Estudiante' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'dentistry', label: 'Odontología' },
  { value: 'construction', label: 'Construcción' },
  { value: 'merchant', label: 'Comerciante' },
  { value: 'cook', label: 'Cocinero' },
  { value: 'nurse', label: 'Enfermero' },
  { value: 'firefighter', label: 'Bombero' },
  { value: 'housewife', label: 'Ama de casa' },
  { value: 'technician', label: 'Técnico' },
  { value: 'electrician', label: 'Electricista' },
  { value: 'driver', label: 'Chofer' },
  { value: 'police', label: 'Policía' },
  { value: 'military', label: 'Militar' },
  { value: 'retired', label: 'Pensionado' },

  // Ministerio.
  { value: 'pastor', label: 'Pastor' },
  { value: 'missionary', label: 'Misionero' },

  // Carreras universitarias.
  { value: 'lawyer', label: 'Abogado' },
  { value: 'accountant', label: 'Contador' },
  { value: 'business_admin', label: 'Administrador de Empresas' },
  { value: 'economist', label: 'Economista' },
  { value: 'civil_engineer', label: 'Ing. Civil' },
  { value: 'engineer', label: 'Ingeniero (otra área)' },
  { value: 'architect', label: 'Arquitecto' },
  { value: 'psychologist', label: 'Psicólogo' },
  { value: 'social_worker', label: 'Trabajador Social' },
  { value: 'pharmacist', label: 'Farmacéutico' },
  { value: 'lab_analyst', label: 'Bioanalista' },
  { value: 'veterinarian', label: 'Veterinario' },
  { value: 'agronomist', label: 'Agrónomo' },
  { value: 'journalist', label: 'Comunicador Social' },
  { value: 'graphic_designer', label: 'Diseñador Gráfico' },
  { value: 'musician', label: 'Músico' },

  // Oficios.
  { value: 'mechanic', label: 'Mecánico' },
  { value: 'plumber', label: 'Plomero' },
  { value: 'carpenter', label: 'Carpintero' },
  { value: 'welder', label: 'Soldador' },
  { value: 'barber', label: 'Barbero' },
  { value: 'stylist', label: 'Estilista' },
  { value: 'tailor', label: 'Sastre o Costurera' },
  { value: 'farmer', label: 'Agricultor' },
  { value: 'security_guard', label: 'Seguridad o Vigilante' },
  { value: 'salesperson', label: 'Vendedor' },
  { value: 'secretary', label: 'Secretario(a)' },

  // Genericas, para quien no se reconoce en ninguna de las anteriores.
  { value: 'private_employee', label: 'Empleado Privado' },
  { value: 'public_employee', label: 'Empleado Público' },
  { value: 'self_employed', label: 'Trabajador Independiente' },
  { value: 'entrepreneur', label: 'Emprendedor' },
  { value: 'unemployed', label: 'Desempleado' },

  { value: 'other', label: 'Otro' },
];

export const MEMBER_OCUPATIONS_SORTED = [...MEMBER_OCUPATIONS].sort((a, b) =>
  a.label.localeCompare(b.label, 'es')
);
