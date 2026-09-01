export const HEALTH_INSURANCE_OPTIONS = [
    { value: 'unknown', label: 'Desconocido' },
    { value: 'yes', label: 'Sí' },
    { value: 'no', label: 'No' },
];


export const HEALTH_INSURANCE_COMPANIES = [
    { value: 'senasa', label: 'SeNaSa' },
    { value: 'humano', label: 'ARS Humano' },
    { value: 'universal', label: 'ARS Universal' },
    { value: 'mapfre', label: 'MAPFRE Salud' },
    { value: 'meta-salud', label: 'MetaSalud' },
    { value: 'futuro', label: 'ARS Futuro' },
    { value: 'yunen', label: 'ARS Yunen' },
    { value: 'renacer', label: 'ARS Renacer' },
    { value: 'monumental', label: 'ARS Monumental' },
    { value: 'semma', label: 'SEMMA' },
];

export const BLOOD_TYPE_OPTIONS = [
    { value: 'unknown', label: 'Desconocido' },
    { value: 'A+', label: 'A+' },
    { value: 'A-', label: 'A-' },
    { value: 'B+', label: 'B+' },
    { value: 'B-', label: 'B-' },
    { value: 'AB+', label: 'AB+' },
    { value: 'AB-', label: 'AB-' },
    { value: 'O+', label: 'O+' },
    { value: 'O-', label: 'O-' },
];

// La relacion con el miembro se mudo a `src/catalogs/parentescos.js`: ahora la
// usan dos pantallas —la Dispensa Medica y los tutores de Padres— y tiene que
// ser la MISMA lista. Se sigue exportando desde aqui para no romper lo que ya la
// importaba por este nombre.
export { PARENTESCOS as MEDICAL_RELATIONSHIP_OPTIONS } from 'src/catalogs/parentescos';


export const MEDICAL_DOCUMENTS = [
    {
        id: 'doc-folder-17',
        memberId: 'member-17',
        name: 'Documentos médicos',
        size: 0,
        type: 'folder',
        url: '',
        tags: ['medical', 'folder'],
        createdAt: '2026-01-16T23:36:00',
        modifiedAt: '2026-01-16T23:36:00',
        isFavorited: false,
    },

    {
        id: 'doc-pdf-1',
        memberId: 'member-17',
        name: 'Certificado_medico_2026.pdf',
        size: 245760,
        type: 'pdf',
        url: '/assets/mock/files/certificado-medico.pdf',
        tags: ['medical', 'pdf', 'certificado'],
        createdAt: '2026-01-15T22:10:00',
        modifiedAt: '2026-01-15T22:10:00',
        isFavorited: true,
    },

    {
        id: 'doc-image-1',
        memberId: 'member-17',
        name: 'Seguro_salud_carnet.jpg',
        size: 4587520,
        type: 'jpg',
        url: '/assets/mock/files/seguro-salud.jpg',
        tags: ['medical', 'image', 'insurance'],
        createdAt: '2026-01-14T21:36:00',
        modifiedAt: '2026-01-14T21:36:00',
        isFavorited: false,
    },
];

//medicación

export const MEDICATION_OPTIONS = [
    { value: 'no', label: 'No' },
    { value: 'yes', label: 'Sí' },
];

export const MEDICATION_SCHEDULE_OPTIONS = [
    { value: 'morning', label: 'Mañana' },
    { value: 'afternoon', label: 'Tarde' },
    { value: 'night', label: 'Noche' },
    { value: 'before_activity', label: 'Antes de actividad' },
    { value: 'emergency', label: 'Emergencia' },
];

export const MEDICATION_REASON_OPTIONS = [
    { value: 'asthma', label: 'Asma' },
    { value: 'allergy', label: 'Alergia' },
    { value: 'epilepsy', label: 'Epilepsia' },
    { value: 'anxiety', label: 'Ansiedad' },
    { value: 'other', label: 'Otro' },
];

export const FOOD_ALLERGY_OPTIONS = [
    { value: 'peanut', label: 'Maní' },
    { value: 'seafood', label: 'Mariscos' },
    { value: 'milk', label: 'Leche' },
    { value: 'gluten', label: 'Gluten' },
    { value: 'other', label: 'Otros' },
];

export const DRUG_ALLERGY_OPTIONS = [
    { value: 'yes', label: 'Sí' },
    { value: 'no', label: 'No' },
];

export const ENVIRONMENTAL_ALLERGY_OPTIONS = [
    { value: 'dust', label: 'Polvo' },
    { value: 'pollen', label: 'Polen' },
    { value: 'insects', label: 'Picaduras' },
    { value: 'other', label: 'Otros' },
];

export const ALLERGY_REACTION_OPTIONS = [
    { value: 'mild', label: 'Leve' },
    { value: 'moderate', label: 'Moderada' },
    { value: 'severe', label: 'Grave' },
];

export const MEDICAL_CONDITIONS_OPTIONS = [
    { id: 'asthma', label: 'Asma' },
    { id: 'diabetes', label: 'Diabetes' },
    { id: 'epilepsy', label: 'Epilepsia / convulsiones' },
    { id: 'hypertension', label: 'Hipertensión' },
    { id: 'heart_problems', label: 'Problemas cardíacos' },
    { id: 'respiratory_problems', label: 'Problemas respiratorios' },
    { id: 'eating_disorders', label: 'Trastornos alimenticios' },
    { id: 'surgery', label: '¿Has sido operado en algún momento?' },
    { id: 'other', label: 'Otros' },
];
