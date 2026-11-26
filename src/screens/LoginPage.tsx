'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { user, login, loginDemo } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedPath = searchParams.get('next');
  const from =
    requestedPath?.startsWith('/') && !requestedPath.startsWith('//')
      ? requestedPath
      : '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) router.replace(from);
  }, [from, router, user]);

  if (user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      router.replace(from);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async () => {
    setError('');
    setSubmitting(true);
    try {
      await loginDemo();
      router.replace(from);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to launch demo workspace.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-8">
        <Link
          href="/login"
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          LeadLedger
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link
            href="/inquiry"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Client Inquiry Form
          </Link>
          <Link
            href="/register"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Create Account
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Left Context Column */}
          <div className="lg:col-span-5 bg-slate-900 text-white p-8 flex flex-col justify-between space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <span>Protected Admin Workspace</span>
              </div>
              <h1 className="font-display text-2xl font-bold leading-tight text-balance">
                Track every incoming lead from inquiry to signed client.
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                Centralize website contact form submissions, manage deal stages,
                log follow-up notes, and stay ahead of client tasks in one
                focused CRM.
              </p>
            </div>

            <div className="pt-6 border-t border-slate-800 space-y-3">
              <div className="text-xs font-medium text-slate-300">
                Want to preview the full pipeline right away?
              </div>
              <button
                type="button"
                onClick={handleDemo}
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-900 bg-white hover:bg-slate-100 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
              >
                <span>Launch Demo Workspace</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Right Form Column */}
          <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center">
            <div className="mb-6">
              <h2 className="font-display text-xl font-bold text-slate-900">
                Sign in to your workspace
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Enter your credentials or create a new admin account.
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

              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Work Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@agency.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-60 rounded-lg transition-colors"
              >
                {submitting ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 gap-4 flex-wrap">
              <span>
                Need an account?{' '}
                <Link
                  href="/register"
                  className="font-medium text-blue-700 hover:underline"
                >
                  Create workspace account
                </Link>
              </span>
              <Link
                href="/inquiry"
                className="font-medium text-slate-700 hover:text-slate-900 hover:underline"
              >
                Open Public Contact Form
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
