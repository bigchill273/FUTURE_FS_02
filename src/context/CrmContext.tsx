import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  Contact,
  FollowUpTask,
  Lead,
  LeadSource,
  LeadStatus,
  Note,
  NoteCategory,
  Priority,
} from '../types/crm';
import { useAuth } from './AuthContext';

export interface LeadInput {
  name: string;
  email: string;
  phone: string;
  company: string;
  source: LeadSource;
  status: LeadStatus;
  value: number;
  priority: Priority;
}

export interface ContactInput {
  name: string;
  email: string;
  phone: string;
  company: string;
  roleTitle: string;
  location: string;
  leadId?: string | null;
}

export interface NoteInput {
  title: string;
  content: string;
  category: NoteCategory;
  leadId?: string | null;
  contactId?: string | null;
}

export interface TaskInput {
  title: string;
  description: string;
  dueDate: string;
  priority: Priority;
  leadId?: string | null;
  contactId?: string | null;
}

interface CrmContextValue {
  leads: Lead[];
  contacts: Contact[];
  notes: Note[];
  tasks: FollowUpTask[];
  loading: boolean;
  error: string | null;
  refreshAll: () => Promise<void>;
  createLead: (input: LeadInput) => Promise<Lead>;
  updateLead: (id: string, patch: Partial<LeadInput>) => Promise<Lead>;
  deleteLead: (id: string) => Promise<void>;
  convertLead: (id: string) => Promise<{ lead: Lead; contact: Contact }>;
  createContact: (input: ContactInput) => Promise<Contact>;
  updateContact: (id: string, patch: Partial<ContactInput>) => Promise<Contact>;
  deleteContact: (id: string) => Promise<void>;
  createNote: (input: NoteInput) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;
  createTask: (input: TaskInput) => Promise<FollowUpTask>;
  updateTask: (
    id: string,
    patch: Partial<TaskInput & { completed: boolean }>
  ) => Promise<FollowUpTask>;
  deleteTask: (id: string) => Promise<void>;
}

const CrmContext = createContext<CrmContextValue | null>(null);

export function CrmProvider({ children }: { children: React.ReactNode }) {
  const { user, apiFetch } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    if (!user) {
      setLeads([]);
      setContacts([]);
      setNotes([]);
      setTasks([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [leadsRes, contactsRes, notesRes, tasksRes] = await Promise.all([
        apiFetch<{ leads: Lead[] }>('/api/leads'),
        apiFetch<{ contacts: Contact[] }>('/api/contacts'),
        apiFetch<{ notes: Note[] }>('/api/notes'),
        apiFetch<{ tasks: FollowUpTask[] }>('/api/tasks'),
      ]);
      setLeads(leadsRes.leads);
      setContacts(contactsRes.contacts);
      setNotes(notesRes.notes);
      setTasks(tasksRes.tasks);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load workspace data.'
      );
    } finally {
      setLoading(false);
    }
  }, [user, apiFetch]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const createLead = useCallback(
    async (input: LeadInput) => {
      const res = await apiFetch<{ lead: Lead }>('/api/leads', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setLeads((prev) => [res.lead, ...prev]);
      return res.lead;
    },
    [apiFetch]
  );

  const updateLead = useCallback(
    async (id: string, patch: Partial<LeadInput>) => {
      const res = await apiFetch<{ lead: Lead }>(`/api/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setLeads((prev) => prev.map((l) => (l.id === id ? res.lead : l)));
      return res.lead;
    },
    [apiFetch]
  );

  const deleteLead = useCallback(
    async (id: string) => {
      await apiFetch<{ ok: boolean }>(`/api/leads/${id}`, {
        method: 'DELETE',
      });
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setNotes((prev) => prev.filter((n) => n.leadId !== id || n.contactId));
      setTasks((prev) => prev.filter((t) => t.leadId !== id || t.contactId));
    },
    [apiFetch]
  );

  const convertLead = useCallback(
    async (id: string) => {
      const res = await apiFetch<{ lead: Lead; contact: Contact }>(
        `/api/leads/${id}/convert`,
        {
          method: 'POST',
        }
      );
      setLeads((prev) => prev.map((l) => (l.id === id ? res.lead : l)));
      setContacts((prev) => {
        const exists = prev.some((c) => c.id === res.contact.id);
        return exists
          ? prev.map((c) => (c.id === res.contact.id ? res.contact : c))
          : [res.contact, ...prev];
      });
      return res;
    },
    [apiFetch]
  );

  const createContact = useCallback(
    async (input: ContactInput) => {
      const res = await apiFetch<{ contact: Contact }>('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setContacts((prev) => [res.contact, ...prev]);
      return res.contact;
    },
    [apiFetch]
  );

  const updateContact = useCallback(
    async (id: string, patch: Partial<ContactInput>) => {
      const res = await apiFetch<{ contact: Contact }>(`/api/contacts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setContacts((prev) => prev.map((c) => (c.id === id ? res.contact : c)));
      return res.contact;
    },
    [apiFetch]
  );

  const deleteContact = useCallback(
    async (id: string) => {
      await apiFetch<{ ok: boolean }>(`/api/contacts/${id}`, {
        method: 'DELETE',
      });
      setContacts((prev) => prev.filter((c) => c.id !== id));
    },
    [apiFetch]
  );

  const createNote = useCallback(
    async (input: NoteInput) => {
      const res = await apiFetch<{ note: Note }>('/api/notes', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setNotes((prev) => [res.note, ...prev]);
      return res.note;
    },
    [apiFetch]
  );

  const deleteNote = useCallback(
    async (id: string) => {
      await apiFetch<{ ok: boolean }>(`/api/notes/${id}`, {
        method: 'DELETE',
      });
      setNotes((prev) => prev.filter((n) => n.id !== id));
    },
    [apiFetch]
  );

  const createTask = useCallback(
    async (input: TaskInput) => {
      const res = await apiFetch<{ task: FollowUpTask }>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setTasks((prev) => [res.task, ...prev]);
      return res.task;
    },
    [apiFetch]
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<TaskInput & { completed: boolean }>) => {
      const res = await apiFetch<{ task: FollowUpTask }>(`/api/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setTasks((prev) => prev.map((t) => (t.id === id ? res.task : t)));
      return res.task;
    },
    [apiFetch]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      await apiFetch<{ ok: boolean }>(`/api/tasks/${id}`, {
        method: 'DELETE',
      });
      setTasks((prev) => prev.filter((t) => t.id !== id));
    },
    [apiFetch]
  );

  return (
    <CrmContext.Provider
      value={{
        leads,
        contacts,
        notes,
        tasks,
        loading,
        error,
        refreshAll,
        createLead,
        updateLead,
        deleteLead,
        convertLead,
        createContact,
        updateContact,
        deleteContact,
        createNote,
        deleteNote,
        createTask,
        updateTask,
        deleteTask,
      }}
    >
      {children}
    </CrmContext.Provider>
  );
}

export function useCrm(): CrmContextValue {
  const ctx = useContext(CrmContext);
  if (!ctx) {
    throw new Error('useCrm must be used inside CrmProvider');
  }
  return ctx;
}
