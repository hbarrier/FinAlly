import { z } from 'zod'
import { PAYMENT_METHODS } from './payment-method'
import { CURRENCIES } from './settings-options'

/**
 * Shared zod primitives for validating Server Action inputs. Actions are public
 * POST endpoints — the sheet-level validation in components/fern/sheets is not a
 * security boundary. Each action parses its input with one of these before touching
 * the database; a failure throws, which `runAction` surfaces as an alert dialog.
 */

export const zId = z.string().min(1, 'Missing id')
export const zNullableId = zId.nullable()
export const zOptionalId = zId.nullable().optional()

/** `YYYY-MM-DD`. */
export const zDateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date')
/** `YYYY-MM`. */
export const zMonth = z.string().regex(/^\d{4}-\d{2}$/, 'Expected a YYYY-MM month')

/** A positive money amount. */
export const zAmount = z.number().finite('Amount must be a number').positive('Amount must be positive')
/** A money amount that may be zero (e.g. a placeholder simulation line). */
export const zAmountOrZero = z.number().finite('Amount must be a number').nonnegative('Amount cannot be negative')
/** A money amount that may be zero or negative (balances, overrides). */
export const zSignedAmount = z.number().finite('Amount must be a number')

export const zKind = z.enum(['expense', 'income'])
export const zCadence = z.enum(['monthly', 'yearly'])
export const zFrequency = z.enum(['monthly', 'yearly'])
export const zPaymentMethod = z.enum(PAYMENT_METHODS)
export const zCurrency = z.enum(CURRENCIES)
export const zPriority = z.enum(['must', 'should', 'nice'])
export const zTaxAllocation = z.enum(['audrey', 'lucie', 'split'])

/** 0 | 1 integer flags as stored in SQLite. */
export const zFlag = z.union([z.literal(0), z.literal(1)])

/** Trimmed non-empty text. */
export const zName = z.string().trim().min(1, 'Name is required')
export const zOptionalText = z.string().nullable().optional()

/**
 * Parse `input` against `schema`, throwing an `Error` whose message is the first
 * validation issue. Keeps action bodies to a single `const data = parse(...)` line.
 */
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? 'Invalid input')
  }
  return result.data
}
