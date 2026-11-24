import React, { useMemo, useState } from 'react';
import { Mail, MapPin, Pencil, Phone, Plus, Search, Trash2 } from 'lucide-react';
import { Contact, NOTE_CATEGORIES, NoteCategory } from '../types/crm';
import { ContactInput, useCrm } from '../context/CrmContext';
import { formatDateShort } from '../utils/crmLogic';
import { ContactModal } from '../components/ContactModal';

export function ContactsPage() {
  const {
    contacts,
    leads,
    notes,
    loading,
    error,
    createContact,
    updateContact,
    deleteContact,
    createNote,
    deleteNote,
  } = useCrm();

  const [contactSearch, setContactSearch] = useState('');
  const [noteCategoryFilter, setNoteCategoryFilter] = useState<
    NoteCategory | 'All'
  >('All');
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCategory, setNoteCategory] = useState<NoteCategory>('General');
  const [noteLinkKey, setNoteLinkKey] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const filteredContacts = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.name, c.email, c.company, c.roleTitle, c.location]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [contacts, contactSearch]);

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (noteCategoryFilter !== 'All' && n.category !== noteCategoryFilter) {
        return false;
      }
      if (contactSearch.trim()) {
        const q = contactSearch.trim().toLowerCase();
        const linkedContact = contacts.find((c) => c.id === n.contactId);
        const linkedLead = leads.find((l) => l.id === n.leadId);
        const haystack = [
          n.title,
          n.content,
          n.category,
          linkedContact?.name ?? '',
          linkedLead?.name ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      }
      return true;
    });
  }, [notes, noteCategoryFilter, contactSearch, contacts, leads]);

  const handleSaveContact = async (input: ContactInput) => {
    if (editingContact) {
      await updateContact(editingContact.id, input);
    } else {
      await createContact(input);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    setSavingNote(true);
    try {
      let contactId: string | null = null;
      let leadId: string | null = null;
      if (noteLinkKey.startsWith('contact:')) {
        contactId = noteLinkKey.replace('contact:', '');
      } else if (noteLinkKey.startsWith('lead:')) {
        leadId = noteLinkKey.replace('lead:', '');
      }

      await createNote({
        title: noteTitle.trim() || `${noteCategory} note`,
        content: noteContent.trim(),
        category: noteCategory,
        contactId,
        leadId,
      });
      setNoteTitle('');
      setNoteContent('');
      setNoteLinkKey('');
    } finally {
      setSavingNote(false);
    }
  };

  if (loading && contacts.length === 0 && notes.length === 0) {
    return (
      <div className="space-y-6">
        <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />
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
    <div className="space-y-8">
      {/* Search & Header Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search contacts and notes"
            placeholder="Search contacts, companies, or notes..."
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingContact(null);
            setContactModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add Contact</span>
        </button>
      </div>

      {/* Contacts Directory */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Client Contacts ({filteredContacts.length})
          </h2>
        </div>

        {filteredContacts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
            <p className="text-sm text-slate-500">
              No contacts found. Convert a lead or add a client contact directly.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingContact(null);
                setContactModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
            >
              Add First Contact
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredContacts.map((contact) => (
              <article
                key={contact.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-semibold text-slate-900 truncate">
                        {contact.name}
                      </h3>
                      <div className="text-xs text-slate-500 truncate">
                        {[contact.roleTitle, contact.company]
                          .filter(Boolean)
                          .join(' · ') || 'Client Contact'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingContact(contact);
                          setContactModalOpen(true);
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                        aria-label={`Edit ${contact.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteContact(contact.id)}
                        className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md"
                        aria-label={`Delete ${contact.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                    {contact.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                        <span className="font-mono tabular-nums">
                          {contact.phone}
                        </span>
                      </div>
                    )}
                    {contact.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                        <span>{contact.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 text-xs text-slate-400 font-mono tabular-nums">
                  Added {formatDateShort(contact.createdAt)}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Notes Section */}
      <section className="space-y-4 pt-6 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Account & Follow-up Notes ({filteredNotes.length})
          </h2>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(['All', ...NOTE_CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setNoteCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  noteCategoryFilter === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Add Note Form */}
          <form
            onSubmit={handleAddNote}
            className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-3.5"
          >
            <h3 className="font-display text-sm font-semibold text-slate-900">
              Log a Note
            </h3>

            <div>
              <label
                htmlFor="note-title-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Title
              </label>
              <input
                id="note-title-input"
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Discovery call summary"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="note-category-select"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Category
                </label>
                <select
                  id="note-category-select"
                  value={noteCategory}
                  onChange={(e) =>
                    setNoteCategory(e.target.value as NoteCategory)
                  }
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {NOTE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="note-link-select"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Link Record
                </label>
                <select
                  id="note-link-select"
                  value={noteLinkKey}
                  onChange={(e) => setNoteLinkKey(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">General</option>
                  {contacts.map((c) => (
                    <option key={`c-${c.id}`} value={`contact:${c.id}`}>
                      Contact: {c.name}
                    </option>
                  ))}
                  {leads.map((l) => (
                    <option key={`l-${l.id}`} value={`lead:${l.id}`}>
                      Lead: {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="note-content-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Note Details *
              </label>
              <textarea
                id="note-content-input"
                rows={4}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write meeting notes, objections, or next milestones..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={savingNote || !noteContent.trim()}
              className="w-full py-2 px-4 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-lg"
            >
              {savingNote ? 'Saving...' : 'Save Note'}
            </button>
          </form>

          {/* Notes Masonry Grid */}
          <div className="lg:col-span-8">
            {filteredNotes.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                No notes match the current filter.
              </div>
            ) : (
              <div className="columns-1 md:columns-2 gap-4 space-y-4">
                {filteredNotes.map((note) => {
                  const linkedContact = contacts.find(
                    (c) => c.id === note.contactId
                  );
                  const linkedLead = leads.find((l) => l.id === note.leadId);
                  const subjectName = linkedContact?.name || linkedLead?.name;

                  return (
                    <article
                      key={note.id}
                      className="break-inside-avoid bg-white border border-slate-200 rounded-xl p-5 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-display text-sm font-semibold text-slate-900">
                            {note.title || note.category}
                          </h3>
                          <div className="mt-0.5 text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                            <span>{note.category}</span>
                            {subjectName && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-medium text-slate-700">
                                  {subjectName}
                                </span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {formatDateShort(note.createdAt)}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteNote(note.id)}
                          className="p-1 text-slate-400 hover:text-red-700 shrink-0"
                          aria-label={`Delete note "${note.title || note.category}"`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {note.content}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <ContactModal
        open={contactModalOpen}
        initialContact={editingContact}
        onClose={() => setContactModalOpen(false)}
        onSave={handleSaveContact}
      />
    </div>
  );
}
