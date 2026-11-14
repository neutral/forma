// The controls that step a scenario's lit walk on its drawing (presentation.md §explorer, A lifecycle drawn):
// back to the start, previous, play or pause, next.
import { useMachine } from '@xstate/react';
import { Button } from 'react-aria-components';
import type { EventFrom } from 'xstate';
import { player } from './machine.ts';
import styles from './Player.module.css';

interface Walk {
  at: number;
  last: number;
  playing: boolean;
  send(event: EventFrom<typeof player>): void;
}

/** The walk a reader steps through: `at` is the step stood at, `last` when the whole walk is lit. */
export function useWalk(last: number): Walk {
  const [state, send] = useMachine(player, { input: { last } });
  return { at: state.context.at, last, playing: state.matches('playing'), send };
}

export function Player({ walk }: { walk: Walk }) {
  const { at, last, playing, send } = walk;
  return (
    <div className={styles.player} role="group" aria-label="steps">
      <Button className={styles.button} isDisabled={at === 0} onPress={() => send({ type: 'reset' })}>
        back to the start
      </Button>
      <Button className={styles.button} isDisabled={at === 0} onPress={() => send({ type: 'previous' })}>
        previous
      </Button>
      {playing ? (
        <Button className={styles.button} onPress={() => send({ type: 'pause' })}>
          pause
        </Button>
      ) : (
        <Button className={styles.button} onPress={() => send({ type: 'play' })}>
          play
        </Button>
      )}
      <Button className={styles.button} isDisabled={at === last} onPress={() => send({ type: 'next' })}>
        next
      </Button>
      <span className={styles.at} aria-live="polite">
        step {at} of {last}
      </span>
    </div>
  );
}
