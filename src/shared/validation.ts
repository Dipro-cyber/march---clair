import { z } from 'zod';

export const WalletModeSchema = z.enum(['practice', 'real']);

export const CreateInvoiceSchema = z
  .object({
    amountSats: z
      .number({ message: 'Amount must be a number in sats' })
      .int({ message: 'Amount must be a whole number of sats' })
      .min(1, { message: 'Amount must be at least 1 sat' })
      .max(2500, {
        message: 'Amount exceeds practice channel capacity (max 2,500 sats)',
      }),
    memo: z
      .string({ message: 'Memo is required' })
      .trim()
      .min(1, { message: 'Memo cannot be empty' })
      .max(120, { message: 'Memo must be 120 characters or fewer' })
      .refine((val) => !/[0-9]{8,}|@/.test(val), {
        message:
          'Do not include phone numbers or email addresses in the memo',
      }),
    expirySeconds: z
      .number()
      .int()
      .min(1)
      .max(3600)
      .optional()
      .default(180),
    mode: WalletModeSchema.optional().default('practice'),
  })
  .strict();

export const InvoiceIdParamSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(3, { message: 'Invoice ID is required' })
      .max(64, { message: 'Invalid invoice ID' })
      .regex(/^[a-zA-Z0-9_-]+$/, { message: 'Invalid invoice ID format' }),
  })
  .strict();

export const WalletModeQuerySchema = z
  .object({
    mode: WalletModeSchema.optional().default('practice'),
  })
  .strict();

export const EmptyQuerySchema = z.object({}).strict();

export const EmptyBodySchema = z.object({}).strict();

export const PayInvoiceBodySchema = z
  .object({
    simulateLatePayment: z.boolean().optional().default(false),
    multiHop: z.boolean().optional().default(false),
  })
  .strict();

export const PrepareLessonBodySchema = z
  .object({
    lessonId: z.number().int().min(1).max(6),
  })
  .strict();

export const TopUpChannelBodySchema = z
  .object({
    additionalSats: z
      .number()
      .int()
      .min(100)
      .max(2000)
      .optional()
      .default(500),
  })
  .strict();

export const ComparePaymentBodySchema = z
  .object({
    amountSats: z.number().int().min(1).max(2500),
  })
  .strict();

export const CustomerDialogueStageSchema = z.enum([
  'intro',
  'pending',
  'paid',
  'expired',
  'failed_capacity',
  'scam_intro',
]);

export const CustomerDialogueRequestSchema = z
  .object({
    lessonId: z.number().int().min(1).max(6),
    language: z.enum(['fr', 'en']),
    stallId: z.enum(['fruit', 'fabric', 'credit']),
    stage: CustomerDialogueStageSchema,
    itemName: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .refine((val) => !/[0-9]{8,}|@/.test(val), {
        message: 'Do not include personal phone numbers or emails',
      }),
    amountSats: z.number().int().min(1).max(2500),
  })
  .strict();

export const CustomerDialogueResponseSchema = z
  .object({
    customerName: z.string().trim().min(1).max(60),
    lines: z
      .array(z.string().trim().min(1).max(240))
      .min(3)
      .max(4),
    conceptHint: z.string().trim().min(1).max(220),
  })
  .strict();

export const CoachQuestionRequestSchema = z
  .object({
    lessonId: z.number().int().min(1).max(6),
    language: z.enum(['fr', 'en']),
    question: z
      .string()
      .trim()
      .min(2, { message: 'Question is too short' })
      .max(240, { message: 'Question must be 240 characters or fewer' })
      .refine((val) => !/[0-9]{8,}|@/.test(val), {
        message: 'Do not include phone numbers or email addresses',
      }),
    recentEvent: z.string().trim().max(180).optional().default(''),
  })
  .strict();

export const CoachAnswerResponseSchema = z
  .object({
    answerLines: z
      .array(z.string().trim().min(1).max(260))
      .min(2)
      .max(4),
    keyTakeaway: z.string().trim().min(1).max(200),
    noFinancialAdviceDisclaimer: z.string().trim().min(1).max(180),
  })
  .strict();

export const NwcCheckRequestSchema = z
  .object({
    connectionString: z
      .string()
      .trim()
      .max(2048, { message: 'Connection string is too long' })
      .optional(),
    saveInSession: z.boolean().optional().default(false),
    language: z.enum(['fr', 'en']).optional().default('fr'),
  })
  .strict();

export const NwcConnectRequestSchema = z
  .object({
    connectionString: z
      .string({ message: 'Please paste an NWC connection string' })
      .trim()
      .min(1, { message: 'Connection string cannot be empty' })
      .max(2048, { message: 'Connection string is too long' }),
    saveInSession: z.boolean().optional().default(true),
    language: z.enum(['fr', 'en']).optional().default('fr'),
  })
  .strict();

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type InvoiceIdParam = z.infer<typeof InvoiceIdParamSchema>;
export type WalletModeQuery = z.infer<typeof WalletModeQuerySchema>;
export type PayInvoiceBody = z.infer<typeof PayInvoiceBodySchema>;
export type PrepareLessonBody = z.infer<typeof PrepareLessonBodySchema>;
export type TopUpChannelBody = z.infer<typeof TopUpChannelBodySchema>;
export type ComparePaymentBody = z.infer<typeof ComparePaymentBodySchema>;
export type CustomerDialogueStage = z.infer<typeof CustomerDialogueStageSchema>;
export type CustomerDialogueRequest = z.infer<
  typeof CustomerDialogueRequestSchema
>;
export type CustomerDialogueResponse = z.infer<
  typeof CustomerDialogueResponseSchema
>;
export type CoachQuestionRequest = z.infer<typeof CoachQuestionRequestSchema>;
export type CoachAnswerResponse = z.infer<typeof CoachAnswerResponseSchema>;
export type WalletMode = z.infer<typeof WalletModeSchema>;
export type NwcCheckRequest = z.infer<typeof NwcCheckRequestSchema>;
export type NwcConnectRequest = z.infer<typeof NwcConnectRequestSchema>;
