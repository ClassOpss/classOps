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

export const YEAR_GROUPS = ["Y9", "Y10", "S1", "Y9_Summits"] as const;
export type YearGroupValue = (typeof YEAR_GROUPS)[number];

// Display label for a year-group value. The enum value must be a valid identifier
// (Y9_Summits), but users see a friendlier label.
const YEAR_GROUP_LABELS: Record<string, string> = {
  Y9_Summits: "Y9 (Summits)",
};

export function yearGroupLabel(yg: string): string {
  return YEAR_GROUP_LABELS[yg] ?? yg;
}
