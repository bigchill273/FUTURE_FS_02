import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  Lead,
  LeadSource,
  LeadStatus,
  PRIORITIES,
  Priority,
} from '../types/crm';
import { LeadInput } from '../context/CrmContext';
import { validateLeadInput } from '../utils/crmLogic';

interface LeadModalProps {
  open: boolean;
  initialLead?: Lead | null;
  onClose: () => void;
  onSave: (input: LeadInput) => Promise<void>;
}

export function LeadModal({
  open,
  initialLead,
  onClose,
  onSave,
}: LeadModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [source, setSource] = useState<LeadSource>('Website Form');
  const [status, setStatus] = useState<LeadStatus>('new');
  const [value, setValue] = useState('5000');
  const [priority, setPriority] = useState<Priority>('medium');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialLead) {
        setName(initialLead.name);
        setEmail(initialLead.email);
        setPhone(initialLead.phone);
        setCompany(initialLead.company);
        setSource(initialLead.source);
        setStatus(initialLead.status);
        setValue(String(initialLead.value));
        setPriority(initialLead.priority);
      } else {
        setName('');
        setEmail('');
        setPhone('');
        setCompany('');
        setSource('Website Form');
        setStatus('new');
        setValue('5000');
        setPriority('medium');
      }
      setErrors({});
      setSubmitError('');
    }
  }, [open, initialLead]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateLeadInput({ name, email, value });
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setSubmitError('');
    setSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        company: company.trim(),
        source,
        status,
        value: Math.round(Number(value) || 0),
        priority,
      });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save lead.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2
            id="lead-modal-title"
            className="font-display text-lg font-semibold text-slate-900"
          >
            {initialLead ? 'Edit Lead' : 'Add New Lead'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            aria-label="Close lead modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4" noValidate>
          {submitError && (
            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {submitError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="lead-name"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Full Name *
              </label>
              <input
                id="lead-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Elena Vance"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="lead-email"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Email Address *
              </label>
              <input
                id="lead-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="elena@vantage.co"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="lead-company"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Company
              </label>
              <input
                id="lead-company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Vantage Tech"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>

            <div>
              <label
                htmlFor="lead-phone"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Phone
              </label>
              <input
                id="lead-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (415) 555-0190"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="lead-source"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Lead Source
              </label>
              <select
                id="lead-source"
                value={source}
                onChange={(e) => setSource(e.target.value as LeadSource)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="lead-status"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Pipeline Status
              </label>
              <select
                id="lead-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="lead-value"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Deal Value (USD)
              </label>
              <input
                id="lead-value"
                type="number"
                min="0"
                step="100"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {errors.value && (
                <p className="mt-1 text-xs text-red-600">{errors.value}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="lead-priority"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Priority
              </label>
              <select
                id="lead-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg whitespace-nowrap"
            >
              {submitting
                ? 'Saving...'
                : initialLead
                  ? 'Save Changes'
                  : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
