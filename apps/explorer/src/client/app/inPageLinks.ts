// A link within the page moves there and leaves the page's address as it is (presentation.md §explorer,
// Use): the address's hash is the router's, and a live page's launch came through it.
import { useEffect } from 'react';
import { scrollBehavior } from '../ui/motion.ts';

export function useInPageLinks() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
      if (!link || event.defaultPrevented) return;
      event.preventDefault();
      const id = link.getAttribute('href')?.slice(1) ?? '';
      document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
}
