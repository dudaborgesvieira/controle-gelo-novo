'use client';

import { useEffect, useMemo } from 'react';
import LegacyAdminDashboard from './AdminDashboardLegacy';

export default function AdminDashboard(props: React.ComponentProps<typeof LegacyAdminDashboard>) {
  useEffect(() => {
    const hideBackupUi = () => {
      const exportButton = document.getElementById('btn-settings-export-backup');
      const backupCard = exportButton?.parentElement?.parentElement;
      if (backupCard instanceof HTMLElement) backupCard.style.display = 'none';

      const backupSelect = document.getElementById('settings-backup-select');
      const backupSetting = backupSelect?.parentElement;
      if (backupSetting instanceof HTMLElement) backupSetting.style.display = 'none';

      const localBackupModal = document.getElementById('local-db-modal-overlay');
      if (localBackupModal instanceof HTMLElement) localBackupModal.style.display = 'none';
    };

    hideBackupUi();
    const observer = new MutationObserver(hideBackupUi);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const chartSafeMovements = useMemo(() => {
    const activeMovements = props.movements.filter(
      (movement) => !(movement.isCanceled || movement.status === 'cancelado')
    );

    const copy = [...props.movements];
    Object.defineProperty(copy, 'forEach', {
      configurable: true,
      value: (callback: Parameters<typeof copy.forEach>[0], thisArg?: unknown) =>
        activeMovements.forEach(callback, thisArg),
    });

    return copy;
  }, [props.movements]);

  return <LegacyAdminDashboard {...props} movements={chartSafeMovements} />;
}
