import {
  FollowUpTask,
  LEAD_SOURCES,
  LEAD_STATUSES,
  Lead,
  LeadSource,
  LeadStatus,
  Priority,
} from '../types/crm';

export interface LeadFilterOptions {
  search: string;
  status: LeadStatus | 'all';
  source: LeadSource | 'all';
  sortBy: 'createdAt' | 'updatedAt' | 'value' | 'name';
  sortDir: 'asc' | 'desc';
}

export interface StatusMetric {
  status: LeadStatus;
  label: string;
  count: number;
  value: number;
}

export interface SourceMetric {
  source: LeadSource;
  count: number;
  convertedCount: number;
  value: number;
}

export interface DashboardMetrics {
  totalLeads: number;
  activeLeads: number;
  convertedLeads: number;
  lostLeads: number;
  conversionRate: number;
  totalPipelineValue: number;
  wonRevenue: number;
  openTasksCount: number;
  overdueTasksCount: number;
  completedTasksCount: number;
  statusBreakdown: StatusMetric[];
  sourceBreakdown: SourceMetric[];
}

export function filterAndSortLeads(
  leads: Lead[],
  options: LeadFilterOptions
): Lead[] {
  const query = options.search.trim().toLowerCase();

  const filtered = leads.filter((lead) => {
    if (options.status !== 'all' && lead.status !== options.status) {
      return false;
    }
    if (options.source !== 'all' && lead.source !== options.source) {
      return false;
    }
    if (query) {
      const haystack = [
        lead.name,
        lead.email,
        lead.company,
        lead.phone,
        lead.source,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });

  const dir = options.sortDir === 'asc' ? 1 : -1;
  return [...filtered].sort((a, b) => {
    switch (options.sortBy) {
      case 'value':
        return (a.value - b.value) * dir;
      case 'name':
        return a.name.localeCompare(b.name) * dir;
      case 'updatedAt':
        return a.updatedAt.localeCompare(b.updatedAt) * dir;
      case 'createdAt':
      default:
        return a.createdAt.localeCompare(b.createdAt) * dir;
    }
  });
}

export function isTaskOverdue(
  task: Pick<FollowUpTask, 'dueDate' | 'completed'>,
  referenceDateIso: string = new Date().toISOString().slice(0, 10)
): boolean {
  if (task.completed) return false;
  if (!task.dueDate) return false;
  const dueDay = task.dueDate.slice(0, 10);
  const refDay = referenceDateIso.slice(0, 10);
  return dueDay < refDay;
}

export function computeDashboardMetrics(
  leads: Lead[],
  tasks: FollowUpTask[],
  referenceDateIso: string = new Date().toISOString().slice(0, 10)
): DashboardMetrics {
  const totalLeads = leads.length;
  const convertedLeads = leads.filter((l) => l.status === 'converted').length;
  const lostLeads = leads.filter((l) => l.status === 'lost').length;
  const activeLeads = leads.filter(
    (l) => l.status !== 'converted' && l.status !== 'lost'
  ).length;

  const conversionRate =
    totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0;

  const totalPipelineValue = leads
    .filter((l) => l.status !== 'lost')
    .reduce((sum, l) => sum + (Number.isFinite(l.value) ? l.value : 0), 0);

  const wonRevenue = leads
    .filter((l) => l.status === 'converted')
    .reduce((sum, l) => sum + (Number.isFinite(l.value) ? l.value : 0), 0);

  const openTasks = tasks.filter((t) => !t.completed);
  const completedTasksCount = tasks.length - openTasks.length;
  const overdueTasksCount = openTasks.filter((t) =>
    isTaskOverdue(t, referenceDateIso)
  ).length;

  const statusBreakdown: StatusMetric[] = LEAD_STATUSES.map(({ value, label }) => {
    const matching = leads.filter((l) => l.status === value);
    return {
      status: value,
      label,
      count: matching.length,
      value: matching.reduce((sum, l) => sum + l.value, 0),
    };
  });

  const sourceBreakdown: SourceMetric[] = LEAD_SOURCES.map((source) => {
    const matching = leads.filter((l) => l.source === source);
    return {
      source,
      count: matching.length,
      convertedCount: matching.filter((l) => l.status === 'converted').length,
      value: matching.reduce((sum, l) => sum + l.value, 0),
    };
  });

  return {
    totalLeads,
    activeLeads,
    convertedLeads,
    lostLeads,
    conversionRate,
    totalPipelineValue,
    wonRevenue,
    openTasksCount: openTasks.length,
    overdueTasksCount,
    completedTasksCount,
    statusBreakdown,
    sourceBreakdown,
  };
}

function escapeCsvCell(raw: string | number): string {
  const str = String(raw ?? '');
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function leadsToCsv(leads: Lead[]): string {
  const headers = [
    'Name',
    'Email',
    'Phone',
    'Company',
    'Source',
    'Status',
    'Priority',
    'Deal Value (USD)',
    'Created At',
    'Updated At',
  ];

  const rows = leads.map((lead) =>
    [
      lead.name,
      lead.email,
      lead.phone,
      lead.company,
      lead.source,
      lead.status,
      lead.priority,
      lead.value,
      lead.createdAt,
      lead.updatedAt,
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

export interface LeadValidationInput {
  name: string;
  email: string;
  value?: number | string;
  source?: string;
  status?: string;
  priority?: string;
}

export function validateLeadInput(input: LeadValidationInput): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  const trimmedName = (input.name ?? '').trim();
  const trimmedEmail = (input.email ?? '').trim();

  if (trimmedName.length < 2) {
    errors.name = 'Full name must be at least 2 characters.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = 'Enter a valid email address.';
  }

  if (input.value !== undefined && input.value !== '') {
    const num = Number(input.value);
    if (!Number.isFinite(num) || num < 0) {
      errors.value = 'Deal value must be zero or a positive number.';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDateShort(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function getStatusLabel(status: LeadStatus): string {
  return LEAD_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function getPriorityLabel(priority: Priority): string {
  switch (priority) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
    default:
      return priority;
  }
}
