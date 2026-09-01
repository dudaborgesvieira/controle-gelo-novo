'use client';

import { useEffect } from 'react';
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

  return <LegacyAdminDashboard {...props} />;
}
