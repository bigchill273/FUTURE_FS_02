'use client';

import { WorkspaceRoute } from '../../src/App';
import { LeadsPage } from '../../src/screens/LeadsPage';

export default function LeadsRoute() {
  return (
    <WorkspaceRoute
      title="Lead Management"
      breadcrumb="Leads"
      renderContent={({ onSelectLead, onEditLead, onNewLead }) => (
        <LeadsPage
          onSelectLead={onSelectLead}
          onEditLead={onEditLead}
          onNewLead={onNewLead}
        />
      )}
    />
  );
}
