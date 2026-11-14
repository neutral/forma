// The standing cell's switch (presentation.md §explorer, Standing): the whole reading as recorded, which is
// shown first, or here.
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { Standing } from '../../../domain/reading.ts';
import styles from './Top.module.css';

export function StandingSwitch({ standing, onSwitch }: { standing: Standing; onSwitch(standing: Standing): void }) {
  return (
    <ToggleButtonGroup
      className={styles.switch}
      aria-label="standing"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[standing]}
      onSelectionChange={(keys) => {
        const next = Standing.safeParse([...keys][0]);
        if (next.success) onSwitch(next.data);
      }}
    >
      <ToggleButton id="recorded" className={styles.option}>
        as recorded
      </ToggleButton>
      <ToggleButton id="here" className={styles.option}>
        here
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
