import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Lead } from './types/crm';
import { AuthProvider } from './context/AuthContext';
import { CrmProvider, LeadInput, useCrm } from './context/CrmContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/AppShell';
import { LeadModal } from './components/LeadModal';
import { LeadDrawer } from './components/LeadDrawer';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PublicInquiryPage } from './pages/PublicInquiryPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeadsPage } from './pages/LeadsPage';
import { PipelinePage } from './pages/PipelinePage';
import { ContactsPage } from './pages/ContactsPage';
import { TasksPage } from './pages/TasksPage';

function WorkspaceLayout({
  title,
  breadcrumb,
  renderContent,
}: {
  title: string;
  breadcrumb: string;
  renderContent: (handlers: {
    onSelectLead: (lead: Lead) => void;
    onEditLead: (lead: Lead) => void;
    onNewLead: () => void;
  }) => React.ReactNode;
}) {
  const { leads, createLead, updateLead } = useCrm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const activeLead = selectedLeadId
    ? leads.find((l) => l.id === selectedLeadId) ?? null
    : null;

  const handleOpenNew = () => {
    setEditingLead(null);
    setModalOpen(true);
  };

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setModalOpen(true);
  };

  const handleSaveLead = async (input: LeadInput) => {
    if (editingLead) {
      await updateLead(editingLead.id, input);
    } else {
      const created = await createLead(input);
      setSelectedLeadId(created.id);
    }
  };

  return (
    <AppShell title={title} breadcrumb={breadcrumb} onNewLead={handleOpenNew}>
      {renderContent({
        onSelectLead: (lead) => setSelectedLeadId(lead.id),
        onEditLead: handleEdit,
        onNewLead: handleOpenNew,
      })}

      <LeadModal
        open={modalOpen}
        initialLead={editingLead}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveLead}
      />

      <LeadDrawer
        lead={activeLead}
        onClose={() => setSelectedLeadId(null)}
        onEditLead={handleEdit}
      />
    </AppShell>
  );
}

function ProtectedWorkspace({
  title,
  breadcrumb,
  renderContent,
}: {
  title: string;
  breadcrumb: string;
  renderContent: (handlers: {
    onSelectLead: (lead: Lead) => void;
    onEditLead: (lead: Lead) => void;
    onNewLead: () => void;
  }) => React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <WorkspaceLayout
        title={title}
        breadcrumb={breadcrumb}
        renderContent={renderContent}
      />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CrmProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/inquiry" element={<PublicInquiryPage />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedWorkspace
                  title="CRM Overview & Analytics"
                  breadcrumb="Overview"
                  renderContent={({ onSelectLead, onNewLead }) => (
                    <DashboardPage
                      onSelectLead={onSelectLead}
                      onNewLead={onNewLead}
                    />
                  )}
                />
              }
            />

            <Route
              path="/leads"
              element={
                <ProtectedWorkspace
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
              }
            />

            <Route
              path="/pipeline"
              element={
                <ProtectedWorkspace
                  title="Sales Pipeline"
                  breadcrumb="Pipeline"
                  renderContent={({ onSelectLead }) => (
                    <PipelinePage onSelectLead={onSelectLead} />
                  )}
                />
              }
            />

            <Route
              path="/contacts"
              element={
                <ProtectedWorkspace
                  title="Contacts & Notes"
                  breadcrumb="Contacts & Notes"
                  renderContent={() => <ContactsPage />}
                />
              }
            />

            <Route
              path="/tasks"
              element={
                <ProtectedWorkspace
                  title="Follow-up Tasks"
                  breadcrumb="Follow-ups"
                  renderContent={() => <TasksPage />}
                />
              }
            />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </CrmProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
