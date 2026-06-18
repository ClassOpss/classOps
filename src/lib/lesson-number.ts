// Day-off cascade (spec 4.8): the displayed lesson number is the running count of
// non-day-off sessions up to and including each one. Day-off sessions show null and
// don't advance the count, so every later number shifts down automatically — computed
// on the fly, never stored.
export function displayedLessonNumbers(sessions: { dayOff: boolean }[]): (number | null)[] {
  let n = 0;
  return sessions.map((s) => (s.dayOff ? null : ++n));
}
