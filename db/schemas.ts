import { z } from 'zod';
import { DEFAULT_ROTATION } from '@/constants/theme';

export const personSchema = z.object({
  local_id: z.string(),
  name: z.string().default(''),
  birth_day: z.string().default(''),
  birth_month: z.string().default(''),
  birth_year: z.string().default(''),
  death_day: z.string().default(''),
  death_month: z.string().default(''),
  death_year: z.string().default(''),
  notes: z.string().default(''),
});

export const graveFormSchema = z.object({
  status: z.enum(['VISIBLE', 'HIDDEN']).default('VISIBLE'),
  type: z.enum(['REGULAR', 'SMALL', 'DOUBLE', 'TRIPLE', 'TREE', 'OTHER']).default('REGULAR'),
  location: z.string().default(''),
  latitude: z.coerce.number().default(0),
  longitude: z.coerce.number().default(0),
  rotation: z.coerce.number().min(-180).max(180).default(DEFAULT_ROTATION),
  notes: z.string().default(''),
  persons: z.array(personSchema).default([]),
});

export type GraveFormData = z.infer<typeof graveFormSchema>;
export type PersonFormData = z.infer<typeof personSchema>;
