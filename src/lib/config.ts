// Single source of truth for every per-operation tunable. Nothing operation-specific
// should be hardcoded elsewhere — read it from here. Multi-tenancy will make getConfig()
// resolve these per Operation (the new-teacher form sets them, pre-filled with these defaults).

export const OPERATION_DEFAULTS = {
  // Branding / personalization
  brandName: "Math by Mo",
  brandSignature: "Team MO", // signs the WhatsApp messages
  logoPath: "/logos/teacher1.png",
  currency: "EGP",

  // Locale
  timeZone: "Africa/Cairo",

  // Deadlines (Cairo time)
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

export type OperationConfig = typeof OPERATION_DEFAULTS;

// For now there is one operation. Multi-tenancy will resolve this from the request's
// operation; keep all reads going through this function so that swap is a one-liner.
export function getConfig(): OperationConfig {
  return OPERATION_DEFAULTS;
}
