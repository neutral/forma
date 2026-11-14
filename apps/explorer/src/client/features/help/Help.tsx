// The help dialog (presentation.md §explorer, No filler), opened by the `?` button or the `?` key; `Escape`
// closes it.
import { Button, Dialog, DialogTrigger, Modal, ModalOverlay } from 'react-aria-components';
import { cx } from '../../ui/cx.ts';
import text from '../../ui/text.module.css';
import { HelpText } from './HelpText.tsx';
import styles from './Help.module.css';

export function Help({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  return (
    <DialogTrigger isOpen={open} onOpenChange={onOpenChange}>
      <div className={cx(text.forma, styles.tools)}>
        <Button className={styles.open} aria-label="Help">
          ?
        </Button>
      </div>
      <ModalOverlay className={styles.backdrop} isDismissable>
        <Modal className={styles.modal}>
          <Dialog className={cx(text.forma, styles.dialog)} aria-label="Help">
            <Button slot="close" className={styles.close}>
              close
            </Button>
            <HelpText />
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
