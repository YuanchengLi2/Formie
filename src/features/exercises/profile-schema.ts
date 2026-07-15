import { z } from "zod";

const cameraViewSchema = z.enum(["front", "side", "rear", "front-45", "rear-45"]);

export const exerciseProfileSchema = z.object({
  camera: z.object({
    preferredView: cameraViewSchema,
    alternatives: z.array(cameraViewSchema),
    requiredLandmarks: z.array(z.string().min(1)).min(1),
    distanceMeters: z.tuple([z.number().positive(), z.number().positive()]).refine(
      ([minimum, maximum]) => maximum > minimum,
      "Maximum camera distance must exceed minimum distance",
    ),
  }),
  phases: z.array(z.string().min(1)).min(2),
  attentionAreas: z.array(z.string().min(1)).min(1),
  commonFaults: z.array(
    z.object({
      observation: z.string().min(1),
      whyItMatters: z.string().min(1),
      cue: z.string().min(1),
    }),
  ),
  analysisInstruction: z
    .string()
    .refine((value) => value.includes("not an exhaustive list"), "Analysis guidance must remain non-exclusive")
    .refine((value) => value.includes("complete video"), "Analysis must cover the complete video"),
});
