import type { LmsType } from "@prisma/client";

// Human label for a class's LMS. `none` means the class has no online platform,
// so there's no "upload" task to do.
export function lmsLabel(lms: LmsType): string {
  switch (lms) {
    case "ie_learn":
      return "IE Learn";
    case "none":
      return "No LMS";
    default:
      return "Google Classroom";
  }
}

// Whether this class has an LMS that assistants must upload lesson material to.
// When false, the classroom-upload task is not assigned and can never be "late".
export function hasLms(lms: LmsType): boolean {
  return lms !== "none";
}
