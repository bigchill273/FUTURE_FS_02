import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { Lead } from '../types/crm';
import { useCrm } from '../context/CrmContext';
import {
  computeDashboardMetrics,
  formatCurrency,
  formatDateShort,
  isTaskOverdue,
} from '../utils/crmLogic';
import { PriorityText, StatusLabel } from '../components/StatusLabel';

interface DashboardPageProps {
  onSelectLead: (lead: Lead) => void;
  onNewLead: () => void;
}

const BAR_COLORS: Record<string, string> = {
  new: 'bg-blue-600',
  contacted: 'bg-slate-600',
  qualified: 'bg-amber-500',
  proposal: 'bg-indigo-600',
  converted: 'bg-emerald-600',
  lost: 'bg-red-500',
};

export function DashboardPage({ onSelectLead, onNewLead }: DashboardPageProps) {
  const { leads, tasks, loading, error, updateTask } = useCrm();

  if (loading && leads.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 bg-white border border-slate-200 rounded-xl p-5 animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
          <div className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white border border-red-200 rounded-xl text-sm text-red-700">
        {error}
      </div>
    );
  }

  const metrics = computeDashboardMetrics(leads, tasks);
  const maxStageCount = Math.max(
    1,
    ...metrics.statusBreakdown.map((s) => s.count)
  );
  const maxSourceCount = Math.max(
    1,
    ...metrics.sourceBreakdown.map((s) => s.count)
  );

  const recentLeads = [...leads]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const upcomingTasks = [...tasks]
    .filter((t) => !t.completed)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* 4-Column KPI Strip */}
      <section
        aria-label="Key metrics"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">Total Leads</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {metrics.totalLeads}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 tabular-nums">
            {metrics.activeLeads} active · {metrics.convertedLeads} converted
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Conversion Rate
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {metrics.conversionRate}%
          </div>
          <div className="mt-1.5 text-xs text-slate-500 tabular-nums">
            {metrics.convertedLeads} won of {metrics.totalLeads} total
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Active Pipeline Value
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {formatCurrency(metrics.totalPipelineValue)}
          </div>
          <div className="mt-1.5 text-xs text-emerald-700 font-medium tabular-nums">
            {formatCurrency(metrics.wonRevenue)} converted revenue
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">
            Open Follow-ups
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {metrics.openTasksCount}
          </div>
          <div
            className={`mt-1.5 text-xs font-medium tabular-nums ${
              metrics.overdueTasksCount > 0 ? 'text-red-700' : 'text-slate-500'
            }`}
          >
            {metrics.overdueTasksCount > 0
              ? `${metrics.overdueTasksCount} overdue · ${metrics.completedTasksCount} completed`
              : `${metrics.completedTasksCount} completed`}
          </div>
        </div>
      </section>

      {/* Analytics Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Stage Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Pipeline Stage Distribution
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Lead volume and deal value across stages
              </p>
            </div>
            <Link
              href="/pipeline"
              className="text-xs font-medium text-blue-700 hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Open board</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>

          {leads.length === 0 ? (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm text-slate-500">
                No leads tracked yet. Add your first lead to see stage metrics.
              </p>
              <button
                type="button"
                onClick={onNewLead}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
              >
                Add First Lead
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {metrics.statusBreakdown.map((item) => {
                const widthPct = Math.max(
                  item.count > 0 ? 6 : 0,
                  Math.round((item.count / maxStageCount) * 100)
                );
                return (
                  <div key={item.status} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">
                        {item.label}
                      </span>
                      <span className="font-mono tabular-nums text-slate-600">
                        {item.count} · {formatCurrency(item.value)}
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          BAR_COLORS[item.status] || 'bg-slate-600'
                        }`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Acquisition Sources */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Lead Sources
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Channel performance and conversions
              </p>
            </div>
            <Link
              href="/leads"
              className="text-xs font-medium text-blue-700 hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Filter leads</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div className="space-y-3.5">
            {metrics.sourceBreakdown.map((item) => {
              const widthPct = Math.max(
                item.count > 0 ? 6 : 0,
                Math.round((item.count / maxSourceCount) * 100)
              );
              return (
                <div key={item.source} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">
                      {item.source}
                    </span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {item.count} {item.count === 1 ? 'lead' : 'leads'} (
                      {item.convertedCount} won) · {formatCurrency(item.value)}
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-800 rounded-full transition-all duration-300"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom Actionable Lists */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Recent Leads
            </h2>
            <Link
              href="/leads"
              className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
            >
              View all leads
            </Link>
          </div>

          {recentLeads.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No incoming leads yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {recentLeads.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => onSelectLead(lead)}
                  className="w-full px-6 py-3.5 text-left hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {lead.name}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 truncate">
                      {lead.company || lead.email} · {lead.source} ·{' '}
                      <span className="font-mono tabular-nums">
                        {formatDateShort(lead.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono font-medium tabular-nums text-slate-700">
                      {formatCurrency(lead.value)}
                    </span>
                    <StatusLabel status={lead.status} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Follow-up Tasks */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Upcoming Follow-ups
            </h2>
            <Link
              href="/tasks"
              className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
            >
              Manage tasks
            </Link>
          </div>

          {upcomingTasks.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              All follow-up tasks are completed.
            </div>
          ) : (
            <ul className="divide-y divide-slate-200">
              {upcomingTasks.map((task) => {
                const overdue = isTaskOverdue(task);
                return (
                  <li
                    key={task.id}
                    className="px-6 py-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        updateTask(task.id, { completed: !task.completed })
                      }
                      className="mt-0.5 text-slate-400 hover:text-blue-700 shrink-0"
                      aria-label={`Complete task "${task.title}"`}
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {task.title}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                        <span className="font-mono tabular-nums">
                          Due {formatDateShort(task.dueDate)}
                        </span>
                        {overdue && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-red-700">
                              Overdue
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <PriorityText priority={task.priority} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
