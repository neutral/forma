/** Class names joined, the absent ones left out. */
export const cx = (...names: (string | false | null | undefined)[]): string => names.filter(Boolean).join(' ');
