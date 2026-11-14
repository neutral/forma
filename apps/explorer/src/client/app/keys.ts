// The page's keys (presentation.md §explorer, Use): `?` opens the help dialog; `Escape` closes the help
// dialog (the dialog itself does that), or else the thing opened last.
import { useEffect } from 'react';

export function usePageKeys({ helpOpen, openHelp, closeLast }: { helpOpen: boolean; openHelp(): void; closeLast(): boolean }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || helpOpen) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]')) return;
      if (event.key === '?') {
        event.preventDefault();
        openHelp();
      } else if (event.key === 'Escape' && closeLast()) event.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [helpOpen, openHelp, closeLast]);
}
