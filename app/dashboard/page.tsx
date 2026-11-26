'use client';

import { WorkspaceRoute } from '../../src/App';
import { DashboardPage } from '../../src/screens/DashboardPage';

export default function DashboardRoute() {
  return (
    <WorkspaceRoute
      title="CRM Overview & Analytics"
      breadcrumb="Overview"
      renderContent={({ onSelectLead, onNewLead }) => (
        <DashboardPage onSelectLead={onSelectLead} onNewLead={onNewLead} />
      )}
    />
  );
}
