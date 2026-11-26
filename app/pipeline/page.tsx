'use client';

import { WorkspaceRoute } from '../../src/App';
import { PipelinePage } from '../../src/screens/PipelinePage';

export default function PipelineRoute() {
  return (
    <WorkspaceRoute
      title="Sales Pipeline"
      breadcrumb="Pipeline"
      renderContent={({ onSelectLead }) => (
        <PipelinePage onSelectLead={onSelectLead} />
      )}
    />
  );
}
