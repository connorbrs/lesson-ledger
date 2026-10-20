import { createPortal } from 'preact/compat';
import { BACKUP_TOO_LARGE_MESSAGE } from '../domain/backup';
import { Alert } from './components';

/** D-08: shown by both Back Up Now entry points when the backup would exceed the cap. Nothing was shared. */
export function BackupTooLargeAlert(props: { onClose: () => void }) {
  return createPortal(
    <Alert title={BACKUP_TOO_LARGE_MESSAGE} buttons={[{ label: 'OK', tone: 'accent', strong: true, onClick: props.onClose }]} />,
    document.querySelector('.app') ?? document.body,
  );
}
