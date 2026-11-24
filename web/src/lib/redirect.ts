/** Leaves CampusMate for an external page (e.g. Google's consent screen). Kept separate for tests. */
export function redirectTo(url: string): void {
  window.location.assign(url);
}
