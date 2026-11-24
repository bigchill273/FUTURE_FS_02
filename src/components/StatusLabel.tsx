import { LeadStatus, Priority } from '../types/crm';
import { getPriorityLabel, getStatusLabel } from '../utils/crmLogic';

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: 'text-blue-700 bg-blue-50/70 border-blue-200',
  contacted: 'text-slate-700 bg-slate-100 border-slate-200',
  qualified: 'text-amber-700 bg-amber-50/80 border-amber-200',
  proposal: 'text-indigo-700 bg-indigo-50/80 border-indigo-200',
  converted: 'text-emerald-700 bg-emerald-50/80 border-emerald-200',
  lost: 'text-red-700 bg-red-50/70 border-red-200',
};

export function StatusLabel({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap ${STATUS_STYLES[status]}`}
    >
      {getStatusLabel(status)}
    </span>
  );
}

const PRIORITY_TEXT: Record<Priority, string> = {
  high: 'text-red-700',
  medium: 'text-amber-700',
  low: 'text-slate-500',
};

export function PriorityText({ priority }: { priority: Priority }) {
  return (
    <span className={`text-xs font-medium whitespace-nowrap ${PRIORITY_TEXT[priority]}`}>
      {getPriorityLabel(priority)} priority
    </span>
  );
}
