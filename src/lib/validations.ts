import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email('Zadejte platný email'),
  full_name: z.string().min(2, 'Jméno musí mít alespoň 2 znaky').max(100),
  password: z
    .string()
    .min(8, 'Heslo musí mít alespoň 8 znaků')
    .regex(/[A-Z]/, 'Heslo musí obsahovat alespoň jedno velké písmeno')
    .regex(/[0-9]/, 'Heslo musí obsahovat alespoň jedno číslo'),
  password_confirm: z.string(),
}).refine(data => data.password === data.password_confirm, {
  message: 'Hesla se neshodují',
  path: ['password_confirm'],
})

export const loginSchema = z.object({
  email: z.string().email('Zadejte platný email'),
  password: z.string().min(1, 'Zadejte heslo'),
})

export const resetPasswordSchema = z.object({
  email: z.string().email('Zadejte platný email'),
})

export const newPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Heslo musí mít alespoň 8 znaků')
    .regex(/[A-Z]/, 'Heslo musí obsahovat alespoň jedno velké písmeno')
    .regex(/[0-9]/, 'Heslo musí obsahovat alespoň jedno číslo'),
  password_confirm: z.string(),
}).refine(data => data.password === data.password_confirm, {
  message: 'Hesla se neshodují',
  path: ['password_confirm'],
})

export const addWineSchema = z.object({
  wine_name: z.string().min(1, 'Zadejte název vína').max(200),
  is_nv: z.boolean().default(false),
  vintage: z
    .number({ invalid_type_error: 'Zadejte platný ročník' })
    .int()
    .min(1900, 'Ročník musí být alespoň 1900')
    .max(new Date().getFullYear() + 1, 'Ročník nesmí být v budoucnu')
    .optional(),
  quantity: z
    .number({ invalid_type_error: 'Zadejte počet lahví' })
    .int()
    .min(1, 'Minimálně 1 lahev')
    .max(9999),
  purchase_price: z.number().positive('Cena musí být kladná').optional().nullable(),
  purchase_currency: z.enum(['CZK', 'EUR', 'USD']).default('CZK'),
  purchase_date: z.string().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  // Manuální zadání (když Gemini nenajde víno)
  color: z.enum(['red', 'white', 'rose', 'orange', 'sparkling', 'dessert', 'fortified']).optional(),
  country_cs: z.string().max(100).optional().nullable(),
})

export const manualWineSchema = z.object({
  name: z.string().min(1, 'Zadejte název vína').max(200),
  vintage: z
    .number({ invalid_type_error: 'Zadejte platný ročník' })
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1),
  color: z.enum(['red', 'white', 'rose', 'orange', 'sparkling', 'dessert', 'fortified'], {
    required_error: 'Vyberte barvu vína',
  }),
  country_cs: z.string().min(1, 'Zadejte zemi původu'),
  winery: z.string().optional().nullable(),
  region_cs: z.string().optional().nullable(),
  grapes_cs: z.array(z.string()).optional().nullable(),
  description_cs: z.string().max(2000).optional().nullable(),
  quantity: z.number().int().min(1).max(9999),
  purchase_price: z.number().positive().optional().nullable(),
  purchase_currency: z.enum(['CZK', 'EUR', 'USD']).default('CZK'),
})

export const removeWineSchema = z.object({
  quantity: z.number().int().min(1, 'Minimálně 1 lahev'),
  reason: z.enum(['purchase', 'gift_received', 'consumed', 'gift_given', 'sold', 'broken', 'import', 'other']),
  date: z.string(),
  consumption_rating: z.number().int().min(0).max(100).optional().nullable(),
  food_paired: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
})

export const imageSchema = z.object({
  file: z
    .instanceof(File)
    .refine(f => f.size <= 2 * 1024 * 1024, 'Maximální velikost obrázku je 2 MB')
    .refine(
      f => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type),
      'Podporované formáty: JPEG, PNG, WebP'
    ),
})

export const importRowSchema = z.object({
  wine_name: z.string().min(1, 'Název vína je povinný').max(200),
  vintage: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1)
    .optional()
    .nullable(),
  quantity: z
    .number({ invalid_type_error: 'Počet lahví musí být číslo' })
    .int()
    .min(1, 'Minimálně 1 lahev')
    .max(9999),
  purchase_date: z.string().optional().nullable(),
  purchase_price: z.number().positive().optional().nullable(),
  purchase_currency: z.enum(['CZK', 'EUR', 'USD']).default('CZK'),
})

export type RegisterFormData = z.infer<typeof registerSchema>
export type LoginFormData = z.infer<typeof loginSchema>
export type AddWineFormData = z.infer<typeof addWineSchema>
export type ManualWineFormData = z.infer<typeof manualWineSchema>
export type RemoveWineFormData = z.infer<typeof removeWineSchema>
export type ImportRowData = z.infer<typeof importRowSchema>
