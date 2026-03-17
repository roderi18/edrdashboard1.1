import * as z from 'zod';
import { schemaUtils } from 'src/components/hook-form';

export const MemberHealthSchema = z.object({
    avatarUrl: schemaUtils.file({ error: 'Avatar is required!' }),
    destName: z.string().min(1, { error: 'Destacamento requerido' }),
    church: z.string().min(1, { error: 'Iglesia requerida' }),
    memberAddress: z.string().min(1, { error: 'Dirección requerida' }),

    regionalName: z.string().optional(),

    status: z.string(),
    isVerified: z.boolean(),

    documents: schemaUtils.file().optional(),

    healthInsurance: z.string().min(1, { error: 'Seleccione una opción' }),
    insuranceName: z.string().optional(),

    // 💊 Medicación
    hasMedication: z.string().default('no'),
    medications: z
        .array(
            z.object({
                name: z.string().min(1, 'Nombre requerido'),
                dose: z.string().optional(),
                schedule: z.array(z.string()).optional(),
                reason: z.string().optional(),
                reasonOther: z.string().optional(),
            })
        )
        .optional(),

    // 🚨 Alergias
    hasAllergies: z.string().default('no'),
    foodAllergies: z.array(z.string()).optional(),
    foodAllergyOther: z.string().optional(),

    drugAllergy: z.string().default('no'),
    drugAllergyDetails: z.string().optional(),

    environmentalAllergies: z.array(z.string()).optional(),
    allergyReaction: z.string().optional(),

    // 🩺 Condiciones médicas
    hasMedicalConditions: z.string().default('no'),
    medicalConditions: z
        .object({
            asthma: z.boolean().optional(),
            diabetes: z.boolean().optional(),
            epilepsy: z.boolean().optional(),
            hypertension: z.boolean().optional(),
            heart_problems: z.boolean().optional(),
            respiratory_problems: z.boolean().optional(),
            eating_disorders: z.boolean().optional(),
            other: z.boolean().optional(),
        })
        .optional(),

    medicalConditionsOther: z.string().optional(),
});
