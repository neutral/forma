// A ruling opened (presentation.md §explorer, "Opening": ruling).
import type { ThingOf } from '../../../../domain/reading.ts';
import { RulingBody } from '../parts/Ruling.tsx';

export const RulingPanel = ({ ruling }: { ruling: ThingOf<'ruling'> }) => <RulingBody ruling={ruling} />;
