import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCrm } from '../context/CrmContext';

export function PublicInquiryPage() {
  const { user } = useAuth();
  const { refreshAll } = useCrm();
  const [searchParams] = useSearchParams();
  const requestedWorkspace = searchParams.get('w') || '';

  const [workspaceName, setWorkspaceName] = useState('Northstar Digital Studio');
  const [workspaceId, setWorkspaceId] = useState(requestedWorkspace);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [value, setValue] = useState('10000');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadWorkspace() {
      try {
        const query = requestedWorkspace
          ? `?w=${encodeURIComponent(requestedWorkspace)}`
          : '';
        const res = await fetch(`/api/public/workspace${query}`, {
          credentials: 'same-origin',
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          workspaceId: string;
          company: string;
        };
        if (active) {
          setWorkspaceId(data.workspaceId);
          setWorkspaceName(data.company);
        }
      } catch {
        // Use default label if lookup fails
      }
    }
    loadWorkspace();
    return () => {
      active = false;
    };
  }, [requestedWorkspace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (name.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          workspaceId: workspaceId || undefined,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          company: company.trim(),
          value: Number(value) || 0,
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to submit inquiry.');
      }
      if (user) {
        await refreshAll();
      }
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to submit inquiry.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setCompany('');
    setValue('10000');
    setMessage('');
    setSubmitted(false);
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-8">
        <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          {workspaceName}
        </span>

        <Link
          to={user ? '/leads' : '/login'}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{user ? 'Back to CRM Leads' : 'Admin Sign in'}</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl p-8">
          {submitted ? (
            <div className="py-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
              </div>
              <h1 className="font-display text-xl font-bold text-slate-900">
                Inquiry received
              </h1>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Your contact request has been saved directly into the{' '}
                <span className="font-medium text-slate-900">
                  {workspaceName}
                </span>{' '}
                CRM pipeline with status <span className="font-medium">New</span>.
              </p>
              <div className="pt-4 flex items-center justify-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Submit Another Inquiry
                </button>
                <Link
                  to={user ? '/leads' : '/login'}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
                >
                  {user ? 'View in Leads Table' : 'Open CRM Admin'}
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="text-xs font-medium text-blue-700">
                  Website Contact Form
                </div>
                <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 text-balance">
                  Start a project conversation
                </h1>
                <p className="mt-1.5 text-sm text-slate-600">
                  Submissions sent here create a tracked lead and initial note in{' '}
                  {workspaceName}.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {error && (
                  <div
                    role="alert"
                    className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg"
                  >
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="inq-name"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Your Name *
                    </label>
                    <input
                      id="inq-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Elena Vance"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="inq-email"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Work Email *
                    </label>
                    <input
                      id="inq-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="elena@vantagetech.co"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="inq-company"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Company
                    </label>
                    <input
                      id="inq-company"
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Vantage Tech"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="inq-phone"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Phone Number
                    </label>
                    <input
                      id="inq-phone"
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (415) 555-0188"
                      className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="inq-budget"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Estimated Project Budget (USD)
                  </label>
                  <input
                    id="inq-budget"
                    type="number"
                    min="0"
                    step="500"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="inq-message"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Project Scope & Timeline
                  </label>
                  <textarea
                    id="inq-message"
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us about your goals, timeline, and deliverables..."
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors"
                >
                  {submitting ? 'Submitting inquiry...' : 'Submit Inquiry'}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
