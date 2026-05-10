import * as z from 'zod';

export const MemberHealthSchema = z.object({
  avatarUrl: z.any().optional().nullable(),
  destName: z.string().optional(),
  church: z.string().optional(),
  memberAddress: z.string().optional(),

  regionalName: z.string().optional(),

  status: z.string().optional(),
  isVerified: z.boolean().optional(),

  documents: z.any().optional().nullable(),

  healthInsurance: z.string().min(1, { error: 'Seleccione una opcion' }),
  insuranceName: z.string().optional(),
  policyNumber: z.string().optional(),
  bloodType: z.string().optional(),
  heightApprox: z.union([z.string(), z.number()]).optional(),
  heightUnit: z.string().optional(),
  weightApprox: z.union([z.string(), z.number()]).optional(),
  weightUnit: z.string().optional(),
  medicalContactName: z.string().optional(),
  medicalPrimaryPhone: z.string().optional(),
  medicalSecondaryPhone: z.string().optional(),
  medicalRelationship: z.string().optional(),
  medicalNotes: z.string().optional(),

  hasMedication: z.string().default('no'),
  medications: z
    .array(
      z.object({
        name: z.string().optional(),
        dose: z.string().optional(),
        schedule: z.array(z.string()).optional(),
        reason: z.string().optional(),
        reasonOther: z.string().optional(),
      })
    )
    .optional(),

  hasAllergies: z.string().default('no'),
  foodAllergies: z.array(z.string()).optional(),
  foodAllergyOther: z.string().optional(),

  drugAllergy: z.string().default('no'),
  drugAllergyDetails: z.string().optional(),

  hasFoodAllergies: z.string().optional(),
  hasEnvironmentalAllergies: z.string().optional(),
  environmentalAllergies: z.array(z.string()).optional(),
  environmentalAllergyOther: z.string().optional(),
  allergyReaction: z.string().optional(),

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
  specialCare: z.string().optional(),
});
