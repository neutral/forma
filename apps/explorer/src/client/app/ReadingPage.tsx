// The one route: the reading in the standing the address names (`?standing=`, `recorded` by default).
// A switch of standing, or a later reading the reader asks for, draws the sheet afresh, every thing closed.
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Standing } from '../../domain/reading.ts';
import { ShownReading, useLaterReading, useSheet } from '../data/reading.tsx';
import { SheetView } from '../features/sheet/SheetView.tsx';
import { Boot } from './Boot.tsx';

const standingIn = (params: URLSearchParams): Standing => Standing.catch('recorded').parse(params.get('standing'));

export function ReadingPage() {
  const [params, setParams] = useSearchParams();
  const standing = standingIn(params);
  const [round, setRound] = useState(0);
  const { sheet, failure } = useSheet(standing, round);
  // The generation a thing read found no longer kept: a later reading is ready.
  const [notKept, setNotKept] = useState<string | null>(null);
  const later = useLaterReading(sheet?.generation ?? '') || (sheet !== null && notKept === sheet.generation);
  if (failure) return <Boot message={failure} />;
  if (!sheet) return <Boot message="Reading the project…" />;
  return (
    <ShownReading standing={sheet.standing} generation={sheet.generation} onNotKept={() => setNotKept(sheet.generation)}>
      <SheetView
        key={`${sheet.standing}:${sheet.generation}`}
        sheet={sheet}
        standing={standing}
        onSwitch={(next) => setParams({ standing: next })}
        later={later}
        onLater={() => setRound((n) => n + 1)}
      />
    </ShownReading>
  );
}
