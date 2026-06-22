// Per-operation configuration. Every operation-specific tunable lives on the
// Operation row; this module defines the shape + defaults and maps a DB row to it.
// Resolve the *current* operation's config via lib/operation.resolveConfig().
//
// Timezone is the one exception: it stays a shared app default (decided), so it is
// NOT part of OperationConfig — it lives in APP_LOCALE and date/display helpers read
// it synchronously.

import type { Operation } from "@prisma/client";

// Shared locale — same for every operation (all operations run in Egypt for now).
export const APP_LOCALE = {
  timeZone: "Africa/Cairo",
} as const;

// Defaults pre-fill the new-teacher onboarding form and back-stop any code path
// that runs before an operation is resolved. Must mirror the Operation column
// defaults in the schema/migration.
export const OPERATION_DEFAULTS = {
  // Branding / personalization
  brandName: "Math by Mo",
  brandSignature: "Team MO", // signs the WhatsApp messages
  logoPath: "/logos/teacher1.png",
  currency: "EGP",

  // Deadlines (Cairo time; the timezone itself is APP_LOCALE, shared)
  dailyDeadlineHour: 21, // 9pm on the session day — attendance / parent update / classroom upload
  weeklyDeadlineWeekday: 6, // Saturday (0=Sun … 6=Sat) — HW correction / grade entry
  weeklyDeadlineHour: 21, // 9pm

  // Pay
  perClassSalary: 1000, // EGP per class covered per month
  officeHourBonus: 100, // EGP per office-hour session
  lateDeduction: 100, // EGP per non-waived late incident
  coverageAdjustment: 50, // EGP moved when one assistant covers another's session (−50 owner / +50 coverer)
  payMultiplier: 1, // global multiplier (spec: all multipliers 1× for now)
} as const;

export type OperationConfig = {
  brandName: string;
  brandSignature: string;
  logoPath: string;
  currency: string;
  dailyDeadlineHour: number;
  weeklyDeadlineWeekday: number;
  weeklyDeadlineHour: number;
  perClassSalary: number;
  officeHourBonus: number;
  lateDeduction: number;
  coverageAdjustment: number;
  payMultiplier: number;
};

// Map an Operation DB row -> the plain-number config the app reads (Decimals -> numbers).
export function operationConfig(op: Operation): OperationConfig {
  return {
    brandName: op.brandName,
    brandSignature: op.brandSignature,
    logoPath: op.logoPath,
    currency: op.currency,
    dailyDeadlineHour: op.dailyDeadlineHour,
    weeklyDeadlineWeekday: op.weeklyDeadlineWeekday,
    weeklyDeadlineHour: op.weeklyDeadlineHour,
    perClassSalary: Number(op.perClassSalary),
    officeHourBonus: Number(op.officeHourBonus),
    lateDeduction: Number(op.lateDeduction),
    coverageAdjustment: Number(op.coverageAdjustment),
    payMultiplier: Number(op.payMultiplier),
  };
}
