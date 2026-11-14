import { Fragment, type ReactNode } from 'react';

/** Names joined as words are: `a`, `a and b`, `a, b and c`. */
export function AndList({ items }: { items: { key: string; node: ReactNode }[] }) {
  return items.map(({ key, node }, i) => (
    <Fragment key={key}>
      {i === 0 ? '' : i === items.length - 1 ? ' and ' : ', '}
      {node}
    </Fragment>
  ));
}
