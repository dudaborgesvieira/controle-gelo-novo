'use client';

import React, { useMemo } from 'react';
import LegacyAdminDashboard from './AdminDashboardLegacy';

type AdminDashboardProps = React.ComponentProps<typeof LegacyAdminDashboard>;

export default function AdminDashboardWrapper(props: AdminDashboardProps) {
  const activeMovements = useMemo(
    () => props.movements.filter((m) => !(m.isCanceled || m.status === 'cancelado')),
    [props.movements]
  );

  const movementsForDashboard = useMemo(() => {
    const copy = [...props.movements];

    Object.defineProperty(copy, 'forEach', {
      configurable: true,
      value: (callback: Parameters<typeof copy.forEach>[0], thisArg?: unknown) =>
        activeMovements.forEach(callback, thisArg),
    });

    return copy;
  }, [props.movements, activeMovements]);

  return (
    <>
      <style jsx global>{`
        div:has(> div > #btn-settings-export-backup) {
          display: none !important;
        }
        #local-db-modal-overlay {
          display: none !important;
        }
      `}</style>
      <LegacyAdminDashboard {...props} movements={movementsForDashboard} />
    </>
  );
}
