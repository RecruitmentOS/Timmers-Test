import { z } from "zod";

export const verticalEnum = z.enum([
  "security", "traffic", "bouw", "zorg", "infra",
]);
export type Vertical = z.infer<typeof verticalEnum>;

export const availabilityEnum = z.enum(["fulltime", "parttime", "flexible"]);
export type Availability = z.infer<typeof availabilityEnum>;

export const customKeySchema = z.object({
  key: z.string().min(1),
  question: z.string().min(1),
  expectedFormat: z.enum(["yes_no", "text", "number", "enum"]),
  enumValues: z.array(z.string()).optional(),
  required: z.boolean().default(false),
});
export type CustomKey = z.infer<typeof customKeySchema>;

export const qualificationCriteriaSchema = z.object({
  mustHave: z.object({
    licenses: z.array(z.string()).optional(),
    vertical: verticalEnum.optional(),
    availability: availabilityEnum.optional(),
    locationRadiusKm: z.number().positive().optional(),
    rightToWork: z.boolean().optional(),
    minAge: z.number().int().positive().optional(),
    customKeys: z.array(customKeySchema).optional(),
  }).default({}),
  niceToHave: z.object({
    experienceYearsMin: z.number().int().nonnegative().optional(),
    certifications: z.array(z.string()).optional(),
    preferredLanguages: z.array(z.string()).optional(),
    freeText: z.string().optional(),
  }).default({}),
});
export type QualificationCriteria = z.infer<typeof qualificationCriteriaSchema>;
