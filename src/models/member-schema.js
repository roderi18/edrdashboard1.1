import * as z from 'zod';
import { isValidPhoneNumber } from 'react-phone-number-input/input';

const getMinimumBirthdate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 5);
    return date;
};

const getMaximumBirthdate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 100);
    return date;
};

// export const MemberValidationSchema = z.object({

//     firstName: z
//         .string()
//         .min(2, 'El nombre debe tener al menos 2 caracteres'),

//     lastName: z
//         .string()
//         .min(2, 'El apellido debe tener al menos 2 caracteres'),

//     email: z
//         .string()
//         .email('Correo inválido')
//         .optional()
//         .or(z.literal('')),

//     phoneNumber: z
//         .string()
//         .min(8, 'Teléfono inválido'),

//     birthdate: z
//         .any()
//         .refine((v) => !!v, {
//             message: 'Debe seleccionar la fecha de nacimiento',
//         }),

//     provinceId: z.any().refine((v) => v !== null && v !== '' && v !== undefined, {
//         message: 'Debe seleccionar una provincia',
//     }),
//     municipioId: z.any().refine((v) => v !== null && v !== '' && v !== undefined, {
//         message: 'Debe seleccionar un municipio',
//     }),
//     sectorId: z.any().refine((v) => v !== null && v !== '' && v !== undefined, {
//         message: 'Debe seleccionar un sector',
//     }), 
//     street: z.string().min(1, 'Debe ingresar la calle'),

//     ocupation: z.any().optional(),

//     memberDivision: z.any().optional(),

//     memberPosition: z.any().optional(),

//     gender: z
//         .string()
//         .min(1, 'Debe seleccionar un género'),

//     shirtSize: z
//         .any()
//         .optional()
//         .nullable(),

//     destLeadershipRole: z.any().optional().nullable(),

//     nationalLeadershipLevel: z.string().optional(),

//     nationalLeadershipRole: z.string().optional(),

//     destId: z.string().optional(),

//     InstructorCertificadoCI: z.number().nullable().default(null),
//     EstatusVigenciaCI: z
//         .union([z.number(), z.literal('na')])
//         .nullable()
//         .default(null),

//     FechaInicioCI: z
//         .any()
//         .nullable()
//         .optional(),

//     FechaVencimientoCI: z
//         .any()
//         .nullable()
//         .optional(),

//     status: z
//         .enum(['active', 'banned'])
//         .default('active'),

// }).superRefine((data, ctx) => {

//     if (data.InstructorCertificadoCI === 1 && !data.FechaInicioCI) {
//         ctx.addIssue({
//             path: ['FechaInicioCI'],
//             code: z.ZodIssueCode.custom,
//             message: 'Debe seleccionar la fecha de inicio CI',
//         });
//     }

//     const today = new Date();

//     const minDate = new Date();
//     minDate.setFullYear(today.getFullYear() - 5);
//     minDate.setDate(minDate.getDate() + 1);

//     if (data.FechaInicioCI) {

//         const start = new Date(data.FechaInicioCI);

//         if (start < minDate || start > today) {
//             ctx.addIssue({
//                 path: ['FechaInicioCI'],
//                 code: z.ZodIssueCode.custom,
//                 message: 'La fecha de inicio debe estar dentro de los últimos 5 años',
//             });
//         }

//     }

// });
export const MemberValidationSchema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),

    email: z.string().optional().or(z.literal('')),

    phoneNumber: z.string().optional(),

    birthdate: z
        .any()
        .optional()
        .nullable()
        .refine((value) => {
            if (!value) return true;

            const birthdate = new Date(value);

            if (Number.isNaN(birthdate.getTime())) return false;

            return birthdate <= getMinimumBirthdate() && birthdate >= getMaximumBirthdate();
        }, 'La edad del miembro debe estar entre 5 y 100 años.'),

    provinceId: z.any().optional().nullable(),
    municipioId: z.any().optional().nullable(),
    sectorId: z.any().optional().nullable(),
    street: z.string().optional(),

    ocupation: z.any().optional(),
    memberDivision: z.any().optional(),
    memberPosition: z.any().optional(),

    gender: z.any().optional(),

    shirtSize: z.any().optional().nullable(),

    destLeadershipRole: z.any().optional().nullable(),

    nationalLeadershipLevel: z.string().optional(),
    nationalLeadershipRole: z.coerce.string().optional(),

    destId: z.coerce.string().optional(),
    idDivision: z.coerce.number().optional().nullable(),

    InstructorCertificadoCI: z.number().nullable().default(null),
    EstatusVigenciaCI: z.union([z.number(), z.literal('na')]).nullable().default(null),

    FechaInicioCI: z.any().nullable().optional(),
    FechaVencimientoCI: z.any().nullable().optional(),

    status: z.enum(['active', 'banned']).default('active'),
});

export const MemberCreateSchema = z.object({
    avatarUrl: z.any().nullable(),

    name: z.string().optional(),

    email: z
        .string()
        .email('Correo inválido')
        .optional()
        .or(z.literal('')),

    phoneNumber: z
        .string()
        .refine(
            (val) => !val || isValidPhoneNumber(val),
            'Teléfono inválido'
        )
        .optional(),

    state: z.string().optional(),
    city: z.string().optional(),
    address: z.string().optional(),

    ocupation: z.string().optional(),
    memberDivision: z.string().optional(),
    memberPosition: z.string().optional(),

    gender: z.string().optional(),
    shirtSize: z.string().optional(),

    status: z.string().optional(),

    InstructorCertificadoCI: z.number().nullable().default(null),
    EstatusVigenciaCI: z.union([z.number(), z.literal('na')]).nullable().default(null),

    FechaInicioCI: z.any().nullable(),
    FechaVencimientoCI: z.any().nullable(),

    isVerified: z.boolean().optional(),
});
