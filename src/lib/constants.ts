// Shared constants (safe to import from server actions, server components, and client).

export const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type Day = (typeof DAYS)[number];

export const YEAR_GROUPS = ["Y9", "Y10", "S1"] as const;
export type YearGroupValue = (typeof YEAR_GROUPS)[number];
