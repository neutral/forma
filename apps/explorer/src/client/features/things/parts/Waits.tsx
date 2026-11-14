import type { Wait } from '../../../../domain/reading.ts';
import { AndList } from '../../../ui/AndList.tsx';

/** What a line waits on, in the page's words, with the account's own item name on hover. */
export function Waits({ waits }: { waits: Wait[] }) {
  return (
    <AndList
      items={waits.map((wait) => ({
        key: wait.item,
        node: <span title={wait.item}>{wait.says}</span>,
      }))}
    />
  );
}
