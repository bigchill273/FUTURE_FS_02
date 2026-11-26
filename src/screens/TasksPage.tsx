import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Plus, Search, Trash2 } from 'lucide-react';
import { PRIORITIES, Priority } from '../types/crm';
import { useCrm } from '../context/CrmContext';
import { formatDateShort, isTaskOverdue } from '../utils/crmLogic';
import { PriorityText } from '../components/StatusLabel';

type TaskStatusFilter = 'all' | 'open' | 'overdue' | 'completed';

export function TasksPage() {
  const {
    tasks,
    leads,
    contacts,
    loading,
    error,
    createTask,
    updateTask,
    deleteTask,
  } = useCrm();

  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [search, setSearch] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [priority, setPriority] = useState<Priority>('medium');
  const [linkKey, setLinkKey] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      const overdue = isTaskOverdue(task);
      if (statusFilter === 'open' && task.completed) return false;
      if (statusFilter === 'completed' && !task.completed) return false;
      if (statusFilter === 'overdue' && !overdue) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }
      if (q) {
        const linkedLead = leads.find((l) => l.id === task.leadId);
        const linkedContact = contacts.find((c) => c.id === task.contactId);
        const haystack = [
          task.title,
          task.description,
          linkedLead?.name ?? '',
          linkedContact?.name ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, search, leads, contacts]);

  const counts = useMemo(() => {
    return {
      all: tasks.length,
      open: tasks.filter((t) => !t.completed).length,
      overdue: tasks.filter((t) => isTaskOverdue(t)).length,
      completed: tasks.filter((t) => t.completed).length,
    };
  }, [tasks]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) return;
    setSaving(true);
    try {
      let leadId: string | null = null;
      let contactId: string | null = null;
      if (linkKey.startsWith('lead:')) {
        leadId = linkKey.replace('lead:', '');
      } else if (linkKey.startsWith('contact:')) {
        contactId = linkKey.replace('contact:', '');
      }

      await createTask({
        title: title.trim(),
        description: description.trim(),
        dueDate,
        priority,
        leadId,
        contactId,
      });
      setTitle('');
      setDescription('');
      setLinkKey('');
    } finally {
      setSaving(false);
    }
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse" />
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Create Task Form */}
      <form
        onSubmit={handleAddTask}
        className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
      >
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Schedule Follow-up
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track next steps with deadlines and priority
          </p>
        </div>

        <div>
          <label
            htmlFor="task-title-input"
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Task Title *
          </label>
          <input
            id="task-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Send revised proposal to Clara"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="task-due-input"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Due Date
            </label>
            <input
              id="task-due-input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label
              htmlFor="task-priority-select"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Priority
            </label>
            <select
              id="task-priority-select"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="task-link-select"
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Related Lead or Contact
          </label>
          <select
            id="task-link-select"
            value={linkKey}
            onChange={(e) => setLinkKey(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="">General Workspace Task</option>
            {leads.map((l) => (
              <option key={`lead-${l.id}`} value={`lead:${l.id}`}>
                Lead: {l.name} ({l.company || l.email})
              </option>
            ))}
            {contacts.map((c) => (
              <option key={`contact-${c.id}`} value={`contact:${c.id}`}>
                Contact: {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="task-desc-input"
            className="block text-xs font-medium text-slate-700 mb-1"
          >
            Details (optional)
          </label>
          <textarea
            id="task-desc-input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Agenda items, deliverables, or context..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <button
          type="submit"
          disabled={saving || title.trim().length < 2}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>{saving ? 'Adding...' : 'Add Follow-up Task'}</span>
        </button>
      </form>

      {/* Right: Filter & Task Queue */}
      <div className="lg:col-span-8 space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Search follow-up tasks"
                placeholder="Search tasks, leads, or contacts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <select
              aria-label="Filter by priority"
              value={priorityFilter}
              onChange={(e) =>
                setPriorityFilter(e.target.value as Priority | 'all')
              }
              className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700"
            >
              <option value="all">All Priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} Priority
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                { id: 'all', label: `All (${counts.all})` },
                { id: 'open', label: `Open (${counts.open})` },
                { id: 'overdue', label: `Overdue (${counts.overdue})` },
                { id: 'completed', label: `Completed (${counts.completed})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
            <h3 className="font-display text-base font-semibold text-slate-900">
              No tasks in this view
            </h3>
            <p className="text-sm text-slate-500">
              Adjust your filters or schedule a new follow-up task on the left.
            </p>
          </div>
        ) : (
          <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
            {filteredTasks.map((task) => {
              const overdue = isTaskOverdue(task);
              const linkedLead = leads.find((l) => l.id === task.leadId);
              const linkedContact = contacts.find(
                (c) => c.id === task.contactId
              );
              const subjectName = linkedLead?.name || linkedContact?.name;

              return (
                <li
                  key={task.id}
                  className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() =>
                      updateTask(task.id, { completed: !task.completed })
                    }
                    className="mt-0.5 text-slate-400 hover:text-blue-700 shrink-0"
                    aria-label={`Mark "${task.title}" as ${task.completed ? 'open' : 'completed'}`}
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-medium ${
                        task.completed
                          ? 'line-through text-slate-400'
                          : 'text-slate-900'
                      }`}
                    >
                      {task.title}
                    </div>
                    {task.description && (
                      <p className="mt-1 text-xs text-slate-600">
                        {task.description}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
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
                      {task.completed && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-emerald-700">
                            Completed
                          </span>
                        </>
                      )}
                      {subjectName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-slate-700">
                            {subjectName}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <PriorityText priority={task.priority} />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteTask(task.id)}
                    className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md shrink-0"
                    aria-label={`Delete task "${task.title}"`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
