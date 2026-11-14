// The app: its source, the open stack that `Escape` closes, the page's keys and links, the help dialog,
// and the hash router that owns the address.
import { useState } from 'react';
import { createHashRouter, RouterProvider } from 'react-router';
import { SourceProvider } from '../data/reading.tsx';
import type { ReadingSource } from '../data/source.ts';
import { Help } from '../features/help/Help.tsx';
import { OpenStack, useOpenStack } from '../ui/opening/stack.tsx';
import { useInPageLinks } from './inPageLinks.ts';
import { usePageKeys } from './keys.ts';
import { ReadingPage } from './ReadingPage.tsx';

export function App({ source }: { source: ReadingSource }) {
  return (
    <SourceProvider source={source}>
      <OpenStack>
        <Page />
      </OpenStack>
    </SourceProvider>
  );
}

function Page() {
  const [router] = useState(() => createHashRouter([{ path: '*', element: <ReadingPage /> }]));
  const [helpOpen, setHelpOpen] = useState(false);
  const stack = useOpenStack();
  usePageKeys({ helpOpen, openHelp: () => setHelpOpen(true), closeLast: stack.closeLast });
  useInPageLinks();
  return (
    <>
      <Help open={helpOpen} onOpenChange={setHelpOpen} />
      <RouterProvider router={router} />
    </>
  );
}
