import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDashboardMetrics,
  filterAndSortLeads,
  isTaskOverdue,
  leadsToCsv,
  validateLeadInput,
} from './crmLogic';
import { FollowUpTask, Lead } from '../types/crm';

const sampleLeads: Lead[] = [
  {
    id: 'l1',
    ownerId: 'u1',
    name: 'Clara Jensen',
    email: 'clara@nordicpay.io',
    phone: '+1 415-555-0140',
    company: 'NordicPay',
    source: 'Website Form',
    status: 'new',
    value: 12000,
    priority: 'high',
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
  },
  {
    id: 'l2',
    ownerId: 'u1',
    name: 'Marcus Vance',
    email: 'marcus@kestrel.co',
    phone: '+1 212-555-0199',
    company: 'Kestrel Labs',
    source: 'Referral',
    status: 'converted',
    value: 24500,
    priority: 'high',
    createdAt: '2026-11-05T09:00:00Z',
    updatedAt: '2026-11-12T15:00:00Z',
  },
  {
    id: 'l3',
    ownerId: 'u1',
    name: 'Priya Nair',
    email: 'priya@solaris.dev',
    phone: '+1 650-555-0172',
    company: 'Solaris Cloud',
    source: 'LinkedIn',
    status: 'lost',
    value: 8000,
    priority: 'low',
    createdAt: '2026-11-02T08:00:00Z',
    updatedAt: '2026-11-08T11:00:00Z',
  },
];

const sampleTasks: FollowUpTask[] = [
  {
    id: 't1',
    ownerId: 'u1',
    leadId: 'l1',
    contactId: null,
    title: 'Send scope proposal',
    description: 'Draft Q4 pricing tiers',
    dueDate: '2026-11-15',
    priority: 'high',
    completed: false,
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
  },
  {
    id: 't2',
    ownerId: 'u1',
    leadId: 'l1',
    contactId: null,
    title: 'Schedule discovery call',
    description: '',
    dueDate: '2026-11-28',
    priority: 'medium',
    completed: false,
    createdAt: '2026-11-10T11:00:00Z',
    updatedAt: '2026-11-10T11:00:00Z',
  },
  {
    id: 't3',
    ownerId: 'u1',
    leadId: 'l2',
    contactId: null,
    title: 'Kickoff onboarding',
    description: '',
    dueDate: '2026-11-12',
    priority: 'medium',
    completed: true,
    createdAt: '2026-11-06T11:00:00Z',
    updatedAt: '2026-11-12T11:00:00Z',
  },
];

test('filterAndSortLeads filters by search, status, and source and sorts accurately', () => {
  const bySearch = filterAndSortLeads(sampleLeads, {
    search: 'nordic',
    status: 'all',
    source: 'all',
    sortBy: 'createdAt',
    sortDir: 'desc',
  });
  assert.equal(bySearch.length, 1);
  assert.equal(bySearch[0].id, 'l1');

  const sortedByValueDesc = filterAndSortLeads(sampleLeads, {
    search: '',
    status: 'all',
    source: 'all',
    sortBy: 'value',
    sortDir: 'desc',
  });
  assert.deepEqual(
    sortedByValueDesc.map((l) => l.id),
    ['l2', 'l1', 'l3']
  );

  const bySourceAndStatus = filterAndSortLeads(sampleLeads, {
    search: '',
    status: 'converted',
    source: 'Referral',
    sortBy: 'name',
    sortDir: 'asc',
  });
  assert.equal(bySourceAndStatus.length, 1);
  assert.equal(bySourceAndStatus[0].name, 'Marcus Vance');
});

test('isTaskOverdue respects completion state and date comparison', () => {
  assert.equal(
    isTaskOverdue({ dueDate: '2026-11-15', completed: false }, '2026-11-20'),
    true
  );
  assert.equal(
    isTaskOverdue({ dueDate: '2026-11-28', completed: false }, '2026-11-20'),
    false
  );
  assert.equal(
    isTaskOverdue({ dueDate: '2026-11-12', completed: true }, '2026-11-20'),
    false
  );
});

test('computeDashboardMetrics calculates conversion rate, pipeline value, and task counts', () => {
  const metrics = computeDashboardMetrics(sampleLeads, sampleTasks, '2026-11-20');
  assert.equal(metrics.totalLeads, 3);
  assert.equal(metrics.convertedLeads, 1);
  assert.equal(metrics.lostLeads, 1);
  assert.equal(metrics.activeLeads, 1);
  assert.equal(metrics.conversionRate, 33.3);
  assert.equal(metrics.totalPipelineValue, 36500);
  assert.equal(metrics.wonRevenue, 24500);
  assert.equal(metrics.openTasksCount, 2);
  assert.equal(metrics.overdueTasksCount, 1);
  assert.equal(metrics.completedTasksCount, 1);
});

test('leadsToCsv escapes quotes, commas, and spreadsheet formulas', () => {
  const maliciousLead: Lead = {
    ...sampleLeads[0],
    name: '=CMD("calc")',
    company: 'Acme, Inc.',
  };
  const csv = leadsToCsv([maliciousLead]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[1].startsWith('"\'=CMD(""calc"")"'));
  assert.ok(lines[1].includes('"Acme, Inc."'));
});

test('validateLeadInput validates name, email, and deal value', () => {
  const invalid = validateLeadInput({ name: 'A', email: 'bad-email', value: -5 });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.name);
  assert.ok(invalid.errors.email);
  assert.ok(invalid.errors.value);

  const valid = validateLeadInput({
    name: 'Elena Vance',
    email: 'elena@vantage.co',
    value: 9500,
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});
});
