import { useEffect, useState } from 'react';
import { sayFailure } from './source.ts';

export type Load<T> = { state: 'pending' } | { state: 'ready'; value: T } | { state: 'failed'; message: string };

const PENDING: Load<never> = { state: 'pending' };

/** What `load` gives, loaded again whenever `key` changes; `key` names what is loaded. */
export function useLoad<T>(key: string, load: () => Promise<T>): Load<T> {
  const [result, setResult] = useState<{ key: string; load: Load<T> } | null>(null);
  useEffect(() => {
    let current = true;
    load().then(
      (value) => {
        if (current) setResult({ key, load: { state: 'ready', value } });
      },
      (error: unknown) => {
        if (current) setResult({ key, load: { state: 'failed', message: sayFailure(error) } });
      },
    );
    return () => {
      current = false;
    };
    // `key` names everything `load` reads, so `load` itself is not a dependency.
  }, [key]);
  return result?.key === key ? result.load : PENDING;
}
