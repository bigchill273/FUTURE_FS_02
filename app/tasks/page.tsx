'use client';

import { WorkspaceRoute } from '../../src/App';
import { TasksPage } from '../../src/screens/TasksPage';

export default function TasksRoute() {
  return (
    <WorkspaceRoute
      title="Follow-up Tasks"
      breadcrumb="Follow-ups"
      renderContent={() => <TasksPage />}
    />
  );
}
