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

    { value: 'other', label: 'Otro' },
];
export const MEMBER_OCUPATIONS_SORTED = [...MEMBER_OCUPATIONS].sort((a, b) =>
    a.label.localeCompare(b.label, 'es')
);

export const NATIONAL_LEADERSHIP_LEVELS = [
    { value: 'none', label: 'Ninguna' },
    { value: 'national', label: 'Nivel Nacional' },
    { value: 'regional', label: 'Nivel Regional' },
    { value: 'sectional', label: 'Nivel Seccional' },
];
