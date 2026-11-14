/** A recorded time as the page shows it: `2026-11-12 03:36`. */
export const when = (iso: string | null | undefined): string => (iso ? iso.slice(0, 16).replace('T', ' ') : '');

export const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
