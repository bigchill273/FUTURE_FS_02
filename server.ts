import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import {
  AuthenticatedRequest,
  clearSessionCookie,
  extractAuthContext,
  hashPassword,
  requireAuth,
  setSessionCookie,
  signSessionToken,
  verifyPassword,
} from './server/auth';
import { getDb, seedWorkspaceData } from './server/db';

const VALID_STATUSES = new Set([
  'new',
  'contacted',
  'qualified',
  'proposal',
  'converted',
  'lost',
]);
const VALID_SOURCES = new Set([
  'Website Form',
  'Referral',
  'LinkedIn',
  'Cold Outreach',
  'Partner',
  'Event',
]);
const VALID_PRIORITIES = new Set(['low', 'medium', 'high']);
const VALID_CATEGORIES = new Set([
  'General',
  'Call',
  'Meeting',
  'Proposal',
  'Follow-up',
]);

function mapLeadRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    name: String(row.name),
    email: String(row.email),
    phone: String(row.phone ?? ''),
    company: String(row.company ?? ''),
    source: String(row.source),
    status: String(row.status),
    value: Number(row.value ?? 0),
    priority: String(row.priority ?? 'medium'),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapContactRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    leadId: row.lead_id ? String(row.lead_id) : null,
    name: String(row.name),
    email: String(row.email),
    phone: String(row.phone ?? ''),
    company: String(row.company ?? ''),
    roleTitle: String(row.role_title ?? ''),
    location: String(row.location ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapNoteRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    leadId: row.lead_id ? String(row.lead_id) : null,
    contactId: row.contact_id ? String(row.contact_id) : null,
    title: String(row.title ?? ''),
    content: String(row.content),
    category: String(row.category ?? 'General'),
    createdAt: String(row.created_at),
  };
}

function mapTaskRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    leadId: row.lead_id ? String(row.lead_id) : null,
    contactId: row.contact_id ? String(row.contact_id) : null,
    title: String(row.title),
    description: String(row.description ?? ''),
    dueDate: String(row.due_date),
    priority: String(row.priority ?? 'medium'),
    completed: Boolean(row.completed),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function ensureDemoWorkspaceUser(): {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  createdAt: string;
} {
  const db = getDb();
  const demoId = 'demo-workspace';
  const existing = db
    .prepare(
      'SELECT id, name, email, company, role, created_at FROM users WHERE id = ?'
    )
    .get(demoId) as
    | {
        id: string;
        name: string;
        email: string;
        company: string;
        role: string;
        created_at: string;
      }
    | undefined;

  if (existing) {
    seedWorkspaceData(db, existing.id);
    return {
      id: existing.id,
      name: existing.name,
      email: existing.email,
      company: existing.company,
      role: existing.role,
      createdAt: existing.created_at,
    };
  }

  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, company, role, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    demoId,
    'Alex Mercer',
    'demo-workspace@leadledger.local',
    '',
    'Northstar Digital Studio',
    'demo',
    now
  );

  seedWorkspaceData(db, demoId);

  return {
    id: demoId,
    name: 'Alex Mercer',
    email: 'demo-workspace@leadledger.local',
    company: 'Northstar Digital Studio',
    role: 'demo',
    createdAt: now,
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  // Initialize DB on startup
  getDb();

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // --- Authentication Routes ---

  app.get('/api/auth/session', (req, res) => {
    const { user } = extractAuthContext(req);
    if (!user) {
      res.json({ authenticated: false, user: null, token: null });
      return;
    }
    const freshToken = signSessionToken(user.id);
    res.json({ authenticated: true, user, token: freshToken });
  });

  app.post('/api/auth/register', (req, res) => {
    const body = req.body ?? {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const company =
      typeof body.company === 'string' ? body.company.trim() : 'My Agency';
    const seedSample = body.seedSample !== false;

    if (name.length < 2) {
      res.status(400).json({ error: 'Name must be at least 2 characters.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (password.length < 8) {
      res
        .status(400)
        .json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    const db = getDb();
    const existing = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(email);
    if (existing) {
      res
        .status(409)
        .json({ error: 'An account with this email already exists.' });
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = hashPassword(password);

    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, company, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, email, passwordHash, company || 'My Workspace', 'admin', now);

    if (seedSample) {
      seedWorkspaceData(db, id);
    }

    const user = {
      id,
      name,
      email,
      company: company || 'My Workspace',
      role: 'admin',
      createdAt: now,
    };

    const token = signSessionToken(id);
    setSessionCookie(req, res, token);
    res.status(201).json({ user, token });
  });

  app.post('/api/auth/login', (req, res) => {
    const body = req.body ?? {};
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!isValidEmail(email) || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const db = getDb();
    const row = db
      .prepare(
        'SELECT id, name, email, password_hash, company, role, created_at FROM users WHERE email = ?'
      )
      .get(email) as
      | {
          id: string;
          name: string;
          email: string;
          password_hash: string;
          company: string;
          role: string;
          created_at: string;
        }
      | undefined;

    if (!row || !row.password_hash || !verifyPassword(password, row.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const user = {
      id: row.id,
      name: row.name,
      email: row.email,
      company: row.company,
      role: row.role,
      createdAt: row.created_at,
    };

    const token = signSessionToken(user.id);
    setSessionCookie(req, res, token);
    res.json({ user, token });
  });

  app.post('/api/auth/demo', (req, res) => {
    const user = ensureDemoWorkspaceUser();
    const token = signSessionToken(user.id);
    setSessionCookie(req, res, token);
    res.json({ user, token });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  // --- Public Website Contact Form Routes ---

  app.get('/api/public/workspace', (req, res) => {
    const requestedId =
      typeof req.query.w === 'string' ? req.query.w.trim() : '';
    const db = getDb();

    let target: { id: string; company: string } | undefined;
    if (requestedId) {
      target = db
        .prepare('SELECT id, company FROM users WHERE id = ?')
        .get(requestedId) as { id: string; company: string } | undefined;
    }

    if (!target) {
      const { user } = extractAuthContext(req);
      if (user) {
        target = { id: user.id, company: user.company };
      }
    }

    if (!target) {
      const demo = ensureDemoWorkspaceUser();
      target = { id: demo.id, company: demo.company };
    }

    res.json({
      workspaceId: target.id,
      company: target.company || 'Northstar Digital Studio',
    });
  });

  app.post('/api/public/leads', (req, res) => {
    const body = req.body ?? {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const company = typeof body.company === 'string' ? body.company.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const workspaceId =
      typeof body.workspaceId === 'string' ? body.workspaceId.trim() : '';
    const rawValue = Number(body.value ?? 0);
    const value =
      Number.isFinite(rawValue) && rawValue >= 0
        ? Math.min(Math.round(rawValue), 10000000)
        : 0;

    if (name.length < 2) {
      res.status(400).json({ error: 'Full name must be at least 2 characters.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }

    const db = getDb();
    let targetOwnerId = '';

    if (workspaceId) {
      const found = db
        .prepare('SELECT id FROM users WHERE id = ?')
        .get(workspaceId) as { id: string } | undefined;
      if (found) targetOwnerId = found.id;
    }

    if (!targetOwnerId) {
      const { user } = extractAuthContext(req);
      if (user) targetOwnerId = user.id;
    }

    if (!targetOwnerId) {
      const demo = ensureDemoWorkspaceUser();
      targetOwnerId = demo.id;
    }

    const leadId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO leads (id, owner_id, name, email, phone, company, source, status, value, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      leadId,
      targetOwnerId,
      name,
      email,
      phone,
      company,
      'Website Form',
      'new',
      value,
      value >= 15000 ? 'high' : 'medium',
      now,
      now
    );

    if (message) {
      db.prepare(
        `INSERT INTO notes (id, owner_id, lead_id, contact_id, title, content, category, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        crypto.randomUUID(),
        targetOwnerId,
        leadId,
        null,
        'Website contact form submission',
        message,
        'General',
        now
      );
    }

    res.status(201).json({
      ok: true,
      leadId,
      message: 'Your inquiry has been submitted.',
    });
  });

  // --- Protected CRM Routes ---

  app.get('/api/leads', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT * FROM leads WHERE owner_id = ? ORDER BY created_at DESC'
      )
      .all(req.user!.id) as Record<string, unknown>[];
    res.json({ leads: rows.map(mapLeadRow) });
  });

  app.post('/api/leads', requireAuth, (req: AuthenticatedRequest, res) => {
    const body = req.body ?? {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const company = typeof body.company === 'string' ? body.company.trim() : '';
    const source = VALID_SOURCES.has(body.source)
      ? String(body.source)
      : 'Website Form';
    const status = VALID_STATUSES.has(body.status) ? String(body.status) : 'new';
    const priority = VALID_PRIORITIES.has(body.priority)
      ? String(body.priority)
      : 'medium';
    const rawValue = Number(body.value ?? 0);

    if (name.length < 2) {
      res.status(400).json({ error: 'Name must be at least 2 characters.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Valid email address is required.' });
      return;
    }
    if (!Number.isFinite(rawValue) || rawValue < 0) {
      res.status(400).json({ error: 'Deal value must be zero or positive.' });
      return;
    }

    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const value = Math.round(rawValue);

    db.prepare(
      `INSERT INTO leads (id, owner_id, name, email, phone, company, source, status, value, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.user!.id,
      name,
      email,
      phone,
      company,
      source,
      status,
      value,
      priority,
      now,
      now
    );

    const created = db
      .prepare('SELECT * FROM leads WHERE id = ? AND owner_id = ?')
      .get(id, req.user!.id) as Record<string, unknown>;
    res.status(201).json({ lead: mapLeadRow(created) });
  });

  app.patch('/api/leads/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const existing = db
      .prepare('SELECT * FROM leads WHERE id = ? AND owner_id = ?')
      .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }

    const body = req.body ?? {};
    const name =
      typeof body.name === 'string'
        ? body.name.trim()
        : String(existing.name);
    const email =
      typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : String(existing.email);
    const phone =
      typeof body.phone === 'string'
        ? body.phone.trim()
        : String(existing.phone ?? '');
    const company =
      typeof body.company === 'string'
        ? body.company.trim()
        : String(existing.company ?? '');
    const source =
      body.source !== undefined && VALID_SOURCES.has(body.source)
        ? String(body.source)
        : String(existing.source);
    const status =
      body.status !== undefined && VALID_STATUSES.has(body.status)
        ? String(body.status)
        : String(existing.status);
    const priority =
      body.priority !== undefined && VALID_PRIORITIES.has(body.priority)
        ? String(body.priority)
        : String(existing.priority);
    const rawValue =
      body.value !== undefined ? Number(body.value) : Number(existing.value);

    if (name.length < 2) {
      res.status(400).json({ error: 'Name must be at least 2 characters.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Valid email address is required.' });
      return;
    }
    if (!Number.isFinite(rawValue) || rawValue < 0) {
      res.status(400).json({ error: 'Deal value must be zero or positive.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE leads
       SET name = ?, email = ?, phone = ?, company = ?, source = ?, status = ?, value = ?, priority = ?, updated_at = ?
       WHERE id = ? AND owner_id = ?`
    ).run(
      name,
      email,
      phone,
      company,
      source,
      status,
      Math.round(rawValue),
      priority,
      now,
      req.params.id,
      req.user!.id
    );

    const updated = db
      .prepare('SELECT * FROM leads WHERE id = ? AND owner_id = ?')
      .get(req.params.id, req.user!.id) as Record<string, unknown>;
    res.json({ lead: mapLeadRow(updated) });
  });

  app.delete('/api/leads/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const info = db
      .prepare('DELETE FROM leads WHERE id = ? AND owner_id = ?')
      .run(req.params.id, req.user!.id);

    if (info.changes === 0) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }

    // Clean up orphaned notes/tasks linked only to this deleted lead
    db.prepare(
      'DELETE FROM notes WHERE lead_id = ? AND contact_id IS NULL AND owner_id = ?'
    ).run(req.params.id, req.user!.id);
    db.prepare(
      'DELETE FROM tasks WHERE lead_id = ? AND contact_id IS NULL AND owner_id = ?'
    ).run(req.params.id, req.user!.id);

    res.json({ ok: true });
  });

  app.post(
    '/api/leads/:id/convert',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const lead = db
        .prepare('SELECT * FROM leads WHERE id = ? AND owner_id = ?')
        .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;

      if (!lead) {
        res.status(404).json({ error: 'Lead not found.' });
        return;
      }

      const now = new Date().toISOString();
      db.prepare(
        'UPDATE leads SET status = ?, updated_at = ? WHERE id = ? AND owner_id = ?'
      ).run('converted', now, req.params.id, req.user!.id);

      let contact = db
        .prepare(
          'SELECT * FROM contacts WHERE (lead_id = ? OR email = ?) AND owner_id = ?'
        )
        .get(req.params.id, String(lead.email), req.user!.id) as
        | Record<string, unknown>
        | undefined;

      if (!contact) {
        const contactId = crypto.randomUUID();
        db.prepare(
          `INSERT INTO contacts (id, owner_id, lead_id, name, email, phone, company, role_title, location, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          contactId,
          req.user!.id,
          req.params.id,
          String(lead.name),
          String(lead.email),
          String(lead.phone ?? ''),
          String(lead.company ?? ''),
          'Client Stakeholder',
          '',
          now,
          now
        );
        contact = db
          .prepare('SELECT * FROM contacts WHERE id = ? AND owner_id = ?')
          .get(contactId, req.user!.id) as Record<string, unknown>;
      }

      const updatedLead = db
        .prepare('SELECT * FROM leads WHERE id = ? AND owner_id = ?')
        .get(req.params.id, req.user!.id) as Record<string, unknown>;

      res.json({
        lead: mapLeadRow(updatedLead),
        contact: mapContactRow(contact),
      });
    }
  );

  // --- Contacts Routes ---

  app.get('/api/contacts', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT * FROM contacts WHERE owner_id = ? ORDER BY updated_at DESC'
      )
      .all(req.user!.id) as Record<string, unknown>[];
    res.json({ contacts: rows.map(mapContactRow) });
  });

  app.post('/api/contacts', requireAuth, (req: AuthenticatedRequest, res) => {
    const body = req.body ?? {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const company = typeof body.company === 'string' ? body.company.trim() : '';
    const roleTitle =
      typeof body.roleTitle === 'string' ? body.roleTitle.trim() : '';
    const location =
      typeof body.location === 'string' ? body.location.trim() : '';
    const leadId =
      typeof body.leadId === 'string' && body.leadId.trim()
        ? body.leadId.trim()
        : null;

    if (name.length < 2) {
      res.status(400).json({ error: 'Name must be at least 2 characters.' });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Valid email address is required.' });
      return;
    }

    const db = getDb();
    if (leadId) {
      const ownsLead = db
        .prepare('SELECT id FROM leads WHERE id = ? AND owner_id = ?')
        .get(leadId, req.user!.id);
      if (!ownsLead) {
        res.status(404).json({ error: 'Linked lead not found.' });
        return;
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO contacts (id, owner_id, lead_id, name, email, phone, company, role_title, location, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.user!.id,
      leadId,
      name,
      email,
      phone,
      company,
      roleTitle,
      location,
      now,
      now
    );

    const created = db
      .prepare('SELECT * FROM contacts WHERE id = ? AND owner_id = ?')
      .get(id, req.user!.id) as Record<string, unknown>;
    res.status(201).json({ contact: mapContactRow(created) });
  });

  app.patch(
    '/api/contacts/:id',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const existing = db
        .prepare('SELECT * FROM contacts WHERE id = ? AND owner_id = ?')
        .get(req.params.id, req.user!.id) as
        | Record<string, unknown>
        | undefined;

      if (!existing) {
        res.status(404).json({ error: 'Contact not found.' });
        return;
      }

      const body = req.body ?? {};
      const name =
        typeof body.name === 'string'
          ? body.name.trim()
          : String(existing.name);
      const email =
        typeof body.email === 'string'
          ? body.email.trim().toLowerCase()
          : String(existing.email);
      const phone =
        typeof body.phone === 'string'
          ? body.phone.trim()
          : String(existing.phone ?? '');
      const company =
        typeof body.company === 'string'
          ? body.company.trim()
          : String(existing.company ?? '');
      const roleTitle =
        typeof body.roleTitle === 'string'
          ? body.roleTitle.trim()
          : String(existing.role_title ?? '');
      const location =
        typeof body.location === 'string'
          ? body.location.trim()
          : String(existing.location ?? '');

      if (name.length < 2) {
        res.status(400).json({ error: 'Name must be at least 2 characters.' });
        return;
      }
      if (!isValidEmail(email)) {
        res.status(400).json({ error: 'Valid email address is required.' });
        return;
      }

      const now = new Date().toISOString();
      db.prepare(
        `UPDATE contacts
         SET name = ?, email = ?, phone = ?, company = ?, role_title = ?, location = ?, updated_at = ?
         WHERE id = ? AND owner_id = ?`
      ).run(
        name,
        email,
        phone,
        company,
        roleTitle,
        location,
        now,
        req.params.id,
        req.user!.id
      );

      const updated = db
        .prepare('SELECT * FROM contacts WHERE id = ? AND owner_id = ?')
        .get(req.params.id, req.user!.id) as Record<string, unknown>;
      res.json({ contact: mapContactRow(updated) });
    }
  );

  app.delete(
    '/api/contacts/:id',
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const info = db
        .prepare('DELETE FROM contacts WHERE id = ? AND owner_id = ?')
        .run(req.params.id, req.user!.id);

      if (info.changes === 0) {
        res.status(404).json({ error: 'Contact not found.' });
        return;
      }
      res.json({ ok: true });
    }
  );

  // --- Notes Routes ---

  app.get('/api/notes', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT * FROM notes WHERE owner_id = ? ORDER BY created_at DESC'
      )
      .all(req.user!.id) as Record<string, unknown>[];
    res.json({ notes: rows.map(mapNoteRow) });
  });

  app.post('/api/notes', requireAuth, (req: AuthenticatedRequest, res) => {
    const body = req.body ?? {};
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const category = VALID_CATEGORIES.has(body.category)
      ? String(body.category)
      : 'General';
    const leadId =
      typeof body.leadId === 'string' && body.leadId.trim()
        ? body.leadId.trim()
        : null;
    const contactId =
      typeof body.contactId === 'string' && body.contactId.trim()
        ? body.contactId.trim()
        : null;

    if (!content) {
      res.status(400).json({ error: 'Note content is required.' });
      return;
    }

    const db = getDb();
    if (leadId) {
      const ownsLead = db
        .prepare('SELECT id FROM leads WHERE id = ? AND owner_id = ?')
        .get(leadId, req.user!.id);
      if (!ownsLead) {
        res.status(404).json({ error: 'Linked lead not found.' });
        return;
      }
    }
    if (contactId) {
      const ownsContact = db
        .prepare('SELECT id FROM contacts WHERE id = ? AND owner_id = ?')
        .get(contactId, req.user!.id);
      if (!ownsContact) {
        res.status(404).json({ error: 'Linked contact not found.' });
        return;
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO notes (id, owner_id, lead_id, contact_id, title, content, category, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.user!.id, leadId, contactId, title, content, category, now);

    const created = db
      .prepare('SELECT * FROM notes WHERE id = ? AND owner_id = ?')
      .get(id, req.user!.id) as Record<string, unknown>;
    res.status(201).json({ note: mapNoteRow(created) });
  });

  app.delete('/api/notes/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const info = db
      .prepare('DELETE FROM notes WHERE id = ? AND owner_id = ?')
      .run(req.params.id, req.user!.id);

    if (info.changes === 0) {
      res.status(404).json({ error: 'Note not found.' });
      return;
    }
    res.json({ ok: true });
  });

  // --- Follow-up Tasks Routes ---

  app.get('/api/tasks', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT * FROM tasks WHERE owner_id = ? ORDER BY completed ASC, due_date ASC'
      )
      .all(req.user!.id) as Record<string, unknown>[];
    res.json({ tasks: rows.map(mapTaskRow) });
  });

  app.post('/api/tasks', requireAuth, (req: AuthenticatedRequest, res) => {
    const body = req.body ?? {};
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description =
      typeof body.description === 'string' ? body.description.trim() : '';
    const dueDate =
      typeof body.dueDate === 'string' && body.dueDate.trim()
        ? body.dueDate.trim().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const priority = VALID_PRIORITIES.has(body.priority)
      ? String(body.priority)
      : 'medium';
    const leadId =
      typeof body.leadId === 'string' && body.leadId.trim()
        ? body.leadId.trim()
        : null;
    const contactId =
      typeof body.contactId === 'string' && body.contactId.trim()
        ? body.contactId.trim()
        : null;

    if (title.length < 2) {
      res
        .status(400)
        .json({ error: 'Task title must be at least 2 characters.' });
      return;
    }

    const db = getDb();
    if (leadId) {
      const ownsLead = db
        .prepare('SELECT id FROM leads WHERE id = ? AND owner_id = ?')
        .get(leadId, req.user!.id);
      if (!ownsLead) {
        res.status(404).json({ error: 'Linked lead not found.' });
        return;
      }
    }
    if (contactId) {
      const ownsContact = db
        .prepare('SELECT id FROM contacts WHERE id = ? AND owner_id = ?')
        .get(contactId, req.user!.id);
      if (!ownsContact) {
        res.status(404).json({ error: 'Linked contact not found.' });
        return;
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO tasks (id, owner_id, lead_id, contact_id, title, description, due_date, priority, completed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.user!.id,
      leadId,
      contactId,
      title,
      description,
      dueDate,
      priority,
      0,
      now,
      now
    );

    const created = db
      .prepare('SELECT * FROM tasks WHERE id = ? AND owner_id = ?')
      .get(id, req.user!.id) as Record<string, unknown>;
    res.status(201).json({ task: mapTaskRow(created) });
  });

  app.patch('/api/tasks/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const existing = db
      .prepare('SELECT * FROM tasks WHERE id = ? AND owner_id = ?')
      .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    const body = req.body ?? {};
    const title =
      typeof body.title === 'string' ? body.title.trim() : String(existing.title);
    const description =
      typeof body.description === 'string'
        ? body.description.trim()
        : String(existing.description ?? '');
    const dueDate =
      typeof body.dueDate === 'string' && body.dueDate.trim()
        ? body.dueDate.trim().slice(0, 10)
        : String(existing.due_date);
    const priority =
      body.priority !== undefined && VALID_PRIORITIES.has(body.priority)
        ? String(body.priority)
        : String(existing.priority);
    const completed =
      typeof body.completed === 'boolean'
        ? body.completed
          ? 1
          : 0
        : Number(existing.completed);

    if (title.length < 2) {
      res
        .status(400)
        .json({ error: 'Task title must be at least 2 characters.' });
      return;
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE tasks
       SET title = ?, description = ?, due_date = ?, priority = ?, completed = ?, updated_at = ?
       WHERE id = ? AND owner_id = ?`
    ).run(
      title,
      description,
      dueDate,
      priority,
      completed,
      now,
      req.params.id,
      req.user!.id
    );

    const updated = db
      .prepare('SELECT * FROM tasks WHERE id = ? AND owner_id = ?')
      .get(req.params.id, req.user!.id) as Record<string, unknown>;
    res.json({ task: mapTaskRow(updated) });
  });

  app.delete('/api/tasks/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const info = db
      .prepare('DELETE FROM tasks WHERE id = ? AND owner_id = ?')
      .run(req.params.id, req.user!.id);

    if (info.changes === 0) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    res.json({ ok: true });
  });

  // --- Vite / Static Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`LeadLedger CRM server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
