'use client';

import { WorkspaceRoute } from '../../src/App';
import { ContactsPage } from '../../src/screens/ContactsPage';

export default function ContactsRoute() {
  return (
    <WorkspaceRoute
      title="Contacts & Notes"
      breadcrumb="Contacts & Notes"
      renderContent={() => <ContactsPage />}
    />
  );
}
