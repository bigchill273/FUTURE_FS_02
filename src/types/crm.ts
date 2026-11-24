export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'converted'
  | 'lost';

export type LeadSource =
  | 'Website Form'
  | 'Referral'
  | 'LinkedIn'
  | 'Cold Outreach'
  | 'Partner'
  | 'Event';

export type Priority = 'low' | 'medium' | 'high';

export type NoteCategory = 'General' | 'Call' | 'Meeting' | 'Proposal' | 'Follow-up';

export interface User {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  ownerId: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  source: LeadSource;
  status: LeadStatus;
  value: number;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  ownerId: string;
  leadId: string | null;
  name: string;
  email: string;
  phone: string;
  company: string;
  roleTitle: string;
  location: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  ownerId: string;
  leadId: string | null;
  contactId: string | null;
  title: string;
  content: string;
  category: NoteCategory;
  createdAt: string;
}

export interface FollowUpTask {
  id: string;
  ownerId: string;
  leadId: string | null;
  contactId: string | null;
  title: string;
  description: string;
  dueDate: string;
  priority: Priority;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
];

export const LEAD_SOURCES: LeadSource[] = [
  'Website Form',
  'Referral',
  'LinkedIn',
  'Cold Outreach',
  'Partner',
  'Event',
];

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export const NOTE_CATEGORIES: NoteCategory[] = [
  'General',
  'Call',
  'Meeting',
  'Proposal',
  'Follow-up',
];
