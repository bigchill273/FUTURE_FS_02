import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Mail,
  Pencil,
  Phone,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  LEAD_STATUSES,
  Lead,
  LeadStatus,
  NOTE_CATEGORIES,
  NoteCategory,
  PRIORITIES,
  Priority,
} from '../types/crm';
import { useCrm } from '../context/CrmContext';
import {
  formatCurrency,
  formatDateShort,
  isTaskOverdue,
} from '../utils/crmLogic';
import { PriorityText, StatusLabel } from './StatusLabel';

interface LeadDrawerProps {
  lead: Lead | null;
  onClose: () => void;
  onEditLead: (lead: Lead) => void;
}

export function LeadDrawer({ lead, onClose, onEditLead }: LeadDrawerProps) {
  const {
    notes,
    tasks,
    contacts,
    updateLead,
    deleteLead,
    convertLead,
    createNote,
    deleteNote,
    createTask,
    updateTask,
    deleteTask,
  } = useCrm();

  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCategory, setNoteCategory] = useState<NoteCategory>('Follow-up');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [taskPriority, setTaskPriority] = useState<Priority>('medium');
  const [busyAction, setBusyAction] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!lead) return null;

  const leadNotes = notes.filter((n) => n.leadId === lead.id);
  const leadTasks = tasks.filter((t) => t.leadId === lead.id);
  const linkedContact = contacts.find(
    (c) => c.leadId === lead.id || c.email.toLowerCase() === lead.email.toLowerCase()
  );

  const handleStatusChange = async (newStatus: LeadStatus) => {
    setBusyAction(true);
    setFeedback(null);
    try {
      await updateLead(lead.id, { status: newStatus });
    } finally {
      setBusyAction(false);
    }
  };

  const handleConvert = async () => {
    setBusyAction(true);
    setFeedback(null);
    try {
      await convertLead(lead.id);
      setFeedback('Converted to client and added to Contacts.');
    } finally {
      setBusyAction(false);
    }
  };

  const handleDeleteLead = async () => {
    setBusyAction(true);
    try {
      await deleteLead(lead.id);
      onClose();
    } finally {
      setBusyAction(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setBusyAction(true);
    try {
      await createNote({
        title: noteTitle.trim() || `${noteCategory} note`,
        content: noteContent.trim(),
        category: noteCategory,
        leadId: lead.id,
        contactId: linkedContact?.id ?? null,
      });
      setNoteTitle('');
      setNoteContent('');
    } finally {
      setBusyAction(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (taskTitle.trim().length < 2) return;
    setBusyAction(true);
    try {
      await createTask({
        title: taskTitle.trim(),
        description: '',
        dueDate: taskDueDate,
        priority: taskPriority,
        leadId: lead.id,
        contactId: linkedContact?.id ?? null,
      });
      setTaskTitle('');
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/35"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-lead-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-xl bg-white border-l border-slate-200 h-full overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4 sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2
                id="drawer-lead-title"
                className="font-display text-xl font-bold text-slate-900 truncate"
              >
                {lead.name}
              </h2>
              <StatusLabel status={lead.status} />
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span>{lead.company || 'Independent'}</span>
              <span aria-hidden="true">·</span>
              <span>{lead.source}</span>
              <span aria-hidden="true">·</span>
              <PriorityText priority={lead.priority} />
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onEditLead(lead)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label={`Edit ${lead.name}`}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDeleteLead}
              disabled={busyAction}
              className="p-2 rounded-lg text-slate-600 hover:text-red-700 hover:bg-red-50"
              aria-label={`Delete ${lead.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Close lead details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8 flex-1">
          {feedback && (
            <div className="p-3 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
              {feedback}
            </div>
          )}

          {/* Core Details & Stage Controls */}
          <section className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="text-xs text-slate-500">Deal Value</div>
                <div className="mt-0.5 text-lg font-mono font-semibold tabular-nums text-slate-900">
                  {formatCurrency(lead.value)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Created</div>
                <div className="mt-0.5 text-sm font-mono tabular-nums text-slate-800">
                  {formatDateShort(lead.createdAt)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Last Updated</div>
                <div className="mt-0.5 text-sm font-mono tabular-nums text-slate-800">
                  {formatDateShort(lead.updatedAt)}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-slate-700">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                <span className="truncate">{lead.email}</span>
              </div>
              {lead.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                  <span className="font-mono tabular-nums">{lead.phone}</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div className="flex-1">
                <label
                  htmlFor="drawer-status-select"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Lead Status
                </label>
                <select
                  id="drawer-status-select"
                  value={lead.status}
                  disabled={busyAction}
                  onChange={(e) =>
                    handleStatusChange(e.target.value as LeadStatus)
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {LEAD_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {lead.status !== 'converted' || !linkedContact ? (
                <button
                  type="button"
                  onClick={handleConvert}
                  disabled={busyAction}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg whitespace-nowrap shrink-0"
                >
                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                  <span>Convert to Client</span>
                </button>
              ) : (
                <div className="text-xs font-medium text-emerald-700 py-2">
                  Client record linked in Contacts
                </div>
              )}
            </div>
          </section>

          {/* Follow-up Tasks */}
          <section className="space-y-4 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-slate-900">
                Follow-up Tasks ({leadTasks.length})
              </h3>
            </div>

            <form onSubmit={handleAddTask} className="space-y-2.5 bg-slate-50 border border-slate-200 rounded-lg p-3.5">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  aria-label="New follow-up task title"
                  placeholder="Add follow-up task (e.g. Send pricing deck)"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="submit"
                  disabled={busyAction || taskTitle.trim().length < 2}
                  className="px-3.5 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg whitespace-nowrap"
                >
                  Add Task
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label htmlFor="drawer-task-due" className="text-xs text-slate-600">
                  Due
                </label>
                <input
                  id="drawer-task-due"
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="px-2.5 py-1 text-xs font-mono bg-white border border-slate-300 rounded-md"
                />
                <label htmlFor="drawer-task-priority" className="text-xs text-slate-600 ml-2">
                  Priority
                </label>
                <select
                  id="drawer-task-priority"
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as Priority)}
                  className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </form>

            {leadTasks.length === 0 ? (
              <p className="text-xs text-slate-500">
                No follow-up tasks scheduled for this lead yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                {leadTasks.map((task) => {
                  const overdue = isTaskOverdue(task);
                  return (
                    <li
                      key={task.id}
                      className="p-3 flex items-start justify-between gap-3 bg-white"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          updateTask(task.id, { completed: !task.completed })
                        }
                        className="mt-0.5 text-slate-500 hover:text-blue-700 shrink-0"
                        aria-label={`Mark "${task.title}" as ${task.completed ? 'incomplete' : 'completed'}`}
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Circle className="w-4 h-4" />
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
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        className="p-1 text-slate-400 hover:text-red-700"
                        aria-label={`Delete task "${task.title}"`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Follow-up Notes */}
          <section className="space-y-4 pt-6 border-t border-slate-200">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Follow-up Notes ({leadNotes.length})
            </h3>

            <form
              onSubmit={handleAddNote}
              className="space-y-2.5 bg-slate-50 border border-slate-200 rounded-lg p-3.5"
            >
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  aria-label="Note title"
                  placeholder="Note heading (optional)"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <select
                  aria-label="Note category"
                  value={noteCategory}
                  onChange={(e) =>
                    setNoteCategory(e.target.value as NoteCategory)
                  }
                  className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg"
                >
                  {NOTE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                rows={3}
                aria-label="Follow-up note details"
                placeholder="Log call outcomes, client feedback, or next steps..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busyAction || !noteContent.trim()}
                  className="px-3.5 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg"
                >
                  Save Note
                </button>
              </div>
            </form>

            {leadNotes.length === 0 ? (
              <p className="text-xs text-slate-500">
                No notes recorded for this lead yet.
              </p>
            ) : (
              <div className="space-y-3">
                {leadNotes.map((note) => (
                  <article
                    key={note.id}
                    className="p-3.5 border border-slate-200 rounded-lg bg-white space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">
                          {note.title || note.category}
                        </h4>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5">
                          <span>{note.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatDateShort(note.createdAt)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteNote(note.id)}
                        className="p-1 text-slate-400 hover:text-red-700"
                        aria-label={`Delete note "${note.title || note.category}"`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
