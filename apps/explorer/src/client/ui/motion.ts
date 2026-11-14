/** Movement is plain where the reader asks for reduced motion (presentation.md §explorer, Use). */
export const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
