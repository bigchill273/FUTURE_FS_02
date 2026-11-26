'use client';

import { useState } from 'react';
import type { Lead } from './types/crm';
import type { LeadInput } from './context/CrmContext';
import { useCrm } from './context/CrmContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/AppShell';
import { LeadModal } from './components/LeadModal';
import { LeadDrawer } from './components/LeadDrawer';

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

export function WorkspaceRoute({
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
