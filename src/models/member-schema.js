import * as z from 'zod';
import { isValidPhoneNumber } from 'react-phone-number-input/input';

export const MemberValidationSchema = z.object({

    firstName: z
        .string()
        .min(2, 'El nombre debe tener al menos 2 caracteres'),

    lastName: z
        .string()
        .min(2, 'El apellido debe tener al menos 2 caracteres'),

    email: z
        .string()
        .email('Correo inválido')
        .optional()
        .or(z.literal('')),

    phoneNumber: z
        .string()
        .min(1, 'Debe ingresar un teléfono')
        .min(8, 'Teléfono inválido'),

    birthdate: z
        .any()
        .refine((v) => !!v, {
            message: 'Debe seleccionar la fecha de nacimiento',
        }),

    country: z
        .string()
        .min(1, 'Debe seleccionar un país'),

    state: z
        .string()
        .min(1, 'Debe seleccionar una provincia'),

    city: z
        .string()
        .min(1, 'Debe seleccionar una ciudad'),

    address: z
        .string()
        .min(2, 'Debe ingresar una dirección'),

    ocupation: z.any().optional(),

    memberDivision: z
        .string()
        .min(1, 'Debe colocar su fecha de nacimiento'),

    memberPosition: z.any().optional(),

    gender: z
        .string()
        .min(1, 'Debe seleccionar un género'),

    shirtSize: z
        .any()
        .optional()
        .nullable(),

    destLeadershipRole: z.any().optional().nullable(),

    nationalLeadershipLevel: z.string().optional(),

    nationalLeadershipRole: z.string().optional(),

    destId: z
        .string()
        .min(1, 'Debe seleccionar un destacamento'),

    InstructorCertificadoCI: z.number().default(0),

    EstatusVigenciaCI: z
        .union([z.number(), z.literal('na')])
        .nullable()
        .default(null),

    FechaInicioCI: z
        .any()
        .nullable()
        .optional(),

    FechaVencimientoCI: z
        .any()
        .nullable()
        .optional(),

    status: z
        .enum(['active', 'banned'])
        .default('active'),

}).superRefine((data, ctx) => {

    if (data.InstructorCertificadoCI === 1 && !data.FechaInicioCI) {
        ctx.addIssue({
            path: ['FechaInicioCI'],
            code: z.ZodIssueCode.custom,
            message: 'Debe seleccionar la fecha de inicio CI',
        });
    }

    const today = new Date();

    const minDate = new Date();
    minDate.setFullYear(today.getFullYear() - 5);
    minDate.setDate(minDate.getDate() + 1);

    if (data.FechaInicioCI) {

        const start = new Date(data.FechaInicioCI);

        if (start < minDate || start > today) {
            ctx.addIssue({
                path: ['FechaInicioCI'],
                code: z.ZodIssueCode.custom,
                message: 'La fecha de inicio debe estar dentro de los últimos 5 años',
            });
        }

    }

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

    InstructorCertificadoCI: z.number().default(0),
    EstatusVigenciaCI: z.union([z.number(), z.literal('na')]).nullable().default(null),

    FechaInicioCI: z.any().nullable(),
    FechaVencimientoCI: z.any().nullable(),

    isVerified: z.boolean().optional(),
});