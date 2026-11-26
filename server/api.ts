import crypto from 'node:crypto';
import {
  clearSessionCookie,
  extractAuthContext,
  hashPassword,
  isSameOriginMutation,
  setSessionCookie,
  signSessionToken,
  verifyPassword,
} from './auth';
import { getDb, seedWorkspaceData } from './db';

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

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(body, { status, headers });
}

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

function ensureDemoWorkspaceUser() {
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

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 1_000_000) {
    throw new ApiError('Request body is too large.', 413);
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > 1_000_000) {
    throw new ApiError('Request body is too large.', 413);
  }
  if (!text.trim()) return {};

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ApiError('Invalid JSON request body.', 400);
  }

  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getAuthenticatedUser(
  request: Request,
  mutation: boolean
): { id: string } | Response {
  const { user, source } = extractAuthContext(request);
  if (!user || !source) {
    return json({ error: 'Authentication required' }, 401);
  }

  if (
    mutation &&
    source === 'cookie' &&
    !isSameOriginMutation(request)
  ) {
    return json({ error: 'Invalid request origin' }, 403);
  }

  return user;
}

function isResponse(value: { id: string } | Response): value is Response {
  return value instanceof Response;
}

function ownsRelatedRecord(
  table: 'leads' | 'contacts' | 'tasks',
  id: string,
  ownerId: string
): boolean {
  return Boolean(
    getDb()
      .prepare(`SELECT id FROM ${table} WHERE id = ? AND owner_id = ?`)
      .get(id, ownerId)
  );
}

async function handleAuth(
  request: Request,
  action: string,
  method: string
): Promise<Response | null> {
  if (action === 'session' && method === 'GET') {
    const { user } = extractAuthContext(request);
    if (!user) {
      return json({ authenticated: false, user: null, token: null });
    }
    return json({
      authenticated: true,
      user,
      token: signSessionToken(user.id),
    });
  }

  if (action === 'register' && method === 'POST') {
    const body = await readBody(request);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const company =
      typeof body.company === 'string' ? body.company.trim() : 'My Agency';
    const seedSample = body.seedSample !== false;

    if (name.length < 2) {
      return json({ error: 'Name must be at least 2 characters.' }, 400);
    }
    if (!isValidEmail(email)) {
      return json({ error: 'Please provide a valid email address.' }, 400);
    }
    if (password.length < 8) {
      return json(
        { error: 'Password must be at least 8 characters long.' },
        400
      );
    }

    const db = getDb();
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
      return json(
        { error: 'An account with this email already exists.' },
        409
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const normalizedCompany = company || 'My Workspace';
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, company, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      name,
      email,
      hashPassword(password),
      normalizedCompany,
      'admin',
      now
    );
    if (seedSample) seedWorkspaceData(db, id);

    const user = {
      id,
      name,
      email,
      company: normalizedCompany,
      role: 'admin',
      createdAt: now,
    };
    const token = signSessionToken(id);
    return json(
      { user, token },
      201,
      { 'Set-Cookie': setSessionCookie(request, token) }
    );
  }

  if (action === 'login' && method === 'POST') {
    const body = await readBody(request);
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!isValidEmail(email) || !password) {
      return json({ error: 'Email and password are required.' }, 400);
    }

    const row = getDb()
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
      return json({ error: 'Invalid email or password.' }, 401);
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
    return json({ user, token }, 200, {
      'Set-Cookie': setSessionCookie(request, token),
    });
  }

  if (action === 'demo' && method === 'POST') {
    const user = ensureDemoWorkspaceUser();
    const token = signSessionToken(user.id);
    return json({ user, token }, 200, {
      'Set-Cookie': setSessionCookie(request, token),
    });
  }

  if (action === 'logout' && method === 'POST') {
    return json({ ok: true }, 200, {
      'Set-Cookie': clearSessionCookie(request),
    });
  }

  return null;
}

async function handlePublic(
  request: Request,
  resource: string,
  method: string
): Promise<Response | null> {
  if (resource === 'workspace' && method === 'GET') {
    const requestedId = new URL(request.url).searchParams.get('w')?.trim() ?? '';
    const db = getDb();

    let target: { id: string; company: string } | undefined;
    if (requestedId) {
      target = db
        .prepare('SELECT id, company FROM users WHERE id = ?')
        .get(requestedId) as { id: string; company: string } | undefined;
    }
    if (!target) {
      const { user } = extractAuthContext(request);
      if (user) target = { id: user.id, company: user.company };
    }
    if (!target) {
      const demo = ensureDemoWorkspaceUser();
      target = { id: demo.id, company: demo.company };
    }

    return json({
      workspaceId: target.id,
      company: target.company || 'Northstar Digital Studio',
    });
  }

  if (resource === 'leads' && method === 'POST') {
    const body = await readBody(request);
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
      return json(
        { error: 'Full name must be at least 2 characters.' },
        400
      );
    }
    if (!isValidEmail(email)) {
      return json({ error: 'Please provide a valid email address.' }, 400);
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
      const { user } = extractAuthContext(request);
      if (user) targetOwnerId = user.id;
    }
    if (!targetOwnerId) targetOwnerId = ensureDemoWorkspaceUser().id;

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

    return json(
      { ok: true, leadId, message: 'Your inquiry has been submitted.' },
      201
    );
  }

  return null;
}

async function handleLeads(
  request: Request,
  id: string | undefined,
  action: string | undefined,
  method: string
): Promise<Response | null> {
  const auth = getAuthenticatedUser(request, method !== 'GET');
  if (isResponse(auth)) return auth;
  const db = getDb();

  if (!id && method === 'GET') {
    const rows = db
      .prepare('SELECT * FROM leads WHERE owner_id = ? ORDER BY created_at DESC')
      .all(auth.id) as Record<string, unknown>[];
    return json({ leads: rows.map(mapLeadRow) });
  }

  if (!id && method === 'POST') {
    const body = await readBody(request);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const company = typeof body.company === 'string' ? body.company.trim() : '';
    const source =
      typeof body.source === 'string' && VALID_SOURCES.has(body.source)
      ? String(body.source)
      : 'Website Form';
    const status =
      typeof body.status === 'string' && VALID_STATUSES.has(body.status)
      ? String(body.status)
      : 'new';
    const priority =
      typeof body.priority === 'string' && VALID_PRIORITIES.has(body.priority)
      ? String(body.priority)
      : 'medium';
    const rawValue = Number(body.value ?? 0);

    if (name.length < 2) {
      return json({ error: 'Name must be at least 2 characters.' }, 400);
    }
    if (!isValidEmail(email)) {
      return json({ error: 'Valid email address is required.' }, 400);
    }
    if (!Number.isFinite(rawValue) || rawValue < 0) {
      return json({ error: 'Deal value must be zero or positive.' }, 400);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO leads (id, owner_id, name, email, phone, company, source, status, value, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      auth.id,
      name,
      email,
      phone,
      company,
      source,
      status,
      Math.round(rawValue),
      priority,
      now,
      now
    );
    const created = db
      .prepare('SELECT * FROM leads WHERE id = ? AND owner_id = ?')
      .get(id, auth.id) as Record<string, unknown>;
    return json({ lead: mapLeadRow(created) }, 201);
  }

  if (!id || !ownsRelatedRecord('leads', id, auth.id)) {
    return json({ error: 'Lead not found.' }, 404);
  }

  if (action === 'convert' && method === 'POST') {
    const lead = db
      .prepare('SELECT * FROM leads WHERE id = ? AND owner_id = ?')
      .get(id, auth.id) as Record<string, unknown>;
    const now = new Date().toISOString();
    db.prepare(
      'UPDATE leads SET status = ?, updated_at = ? WHERE id = ? AND owner_id = ?'
    ).run('converted', now, id, auth.id);

    let contact = db
      .prepare(
        'SELECT * FROM contacts WHERE (lead_id = ? OR email = ?) AND owner_id = ?'
      )
      .get(id, String(lead.email), auth.id) as
      | Record<string, unknown>
      | undefined;
    if (!contact) {
      const contactId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO contacts (id, owner_id, lead_id, name, email, phone, company, role_title, location, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        contactId,
        auth.id,
        id,
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
        .get(contactId, auth.id) as Record<string, unknown>;
    }

    const updatedLead = db
      .prepare('SELECT * FROM leads WHERE id = ? AND owner_id = ?')
      .get(id, auth.id) as Record<string, unknown>;
    return json({
      lead: mapLeadRow(updatedLead),
      contact: mapContactRow(contact),
    });
  }

  if (method === 'PATCH') {
    const existing = db
      .prepare('SELECT * FROM leads WHERE id = ? AND owner_id = ?')
      .get(id, auth.id) as Record<string, unknown>;
    const body = await readBody(request);
    const name =
      typeof body.name === 'string' ? body.name.trim() : String(existing.name);
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
      typeof body.source === 'string' && VALID_SOURCES.has(body.source)
        ? String(body.source)
        : String(existing.source);
    const status =
      typeof body.status === 'string' && VALID_STATUSES.has(body.status)
        ? String(body.status)
        : String(existing.status);
    const priority =
      typeof body.priority === 'string' && VALID_PRIORITIES.has(body.priority)
        ? String(body.priority)
        : String(existing.priority);
    const rawValue =
      body.value !== undefined ? Number(body.value) : Number(existing.value);

    if (name.length < 2) {
      return json({ error: 'Name must be at least 2 characters.' }, 400);
    }
    if (!isValidEmail(email)) {
      return json({ error: 'Valid email address is required.' }, 400);
    }
    if (!Number.isFinite(rawValue) || rawValue < 0) {
      return json({ error: 'Deal value must be zero or positive.' }, 400);
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
      id,
      auth.id
    );
    const updated = db
      .prepare('SELECT * FROM leads WHERE id = ? AND owner_id = ?')
      .get(id, auth.id) as Record<string, unknown>;
    return json({ lead: mapLeadRow(updated) });
  }

  if (method === 'DELETE') {
    db.prepare('DELETE FROM leads WHERE id = ? AND owner_id = ?').run(
      id,
      auth.id
    );
    db.prepare(
      'DELETE FROM notes WHERE lead_id = ? AND contact_id IS NULL AND owner_id = ?'
    ).run(id, auth.id);
    db.prepare(
      'DELETE FROM tasks WHERE lead_id = ? AND contact_id IS NULL AND owner_id = ?'
    ).run(id, auth.id);
    return json({ ok: true });
  }

  return null;
}

async function handleContacts(
  request: Request,
  id: string | undefined,
  method: string
): Promise<Response | null> {
  const auth = getAuthenticatedUser(request, method !== 'GET');
  if (isResponse(auth)) return auth;
  const db = getDb();

  if (!id && method === 'GET') {
    const rows = db
      .prepare('SELECT * FROM contacts WHERE owner_id = ? ORDER BY updated_at DESC')
      .all(auth.id) as Record<string, unknown>[];
    return json({ contacts: rows.map(mapContactRow) });
  }

  if (!id && method === 'POST') {
    const body = await readBody(request);
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
      return json({ error: 'Name must be at least 2 characters.' }, 400);
    }
    if (!isValidEmail(email)) {
      return json({ error: 'Valid email address is required.' }, 400);
    }
    if (leadId && !ownsRelatedRecord('leads', leadId, auth.id)) {
      return json({ error: 'Linked lead not found.' }, 404);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO contacts (id, owner_id, lead_id, name, email, phone, company, role_title, location, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      auth.id,
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
      .get(id, auth.id) as Record<string, unknown>;
    return json({ contact: mapContactRow(created) }, 201);
  }

  if (!id || !ownsRelatedRecord('contacts', id, auth.id)) {
    return json({ error: 'Contact not found.' }, 404);
  }

  if (method === 'PATCH') {
    const existing = db
      .prepare('SELECT * FROM contacts WHERE id = ? AND owner_id = ?')
      .get(id, auth.id) as Record<string, unknown>;
    const body = await readBody(request);
    const name =
      typeof body.name === 'string' ? body.name.trim() : String(existing.name);
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
      return json({ error: 'Name must be at least 2 characters.' }, 400);
    }
    if (!isValidEmail(email)) {
      return json({ error: 'Valid email address is required.' }, 400);
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE contacts
       SET name = ?, email = ?, phone = ?, company = ?, role_title = ?, location = ?, updated_at = ?
       WHERE id = ? AND owner_id = ?`
    ).run(name, email, phone, company, roleTitle, location, now, id, auth.id);
    const updated = db
      .prepare('SELECT * FROM contacts WHERE id = ? AND owner_id = ?')
      .get(id, auth.id) as Record<string, unknown>;
    return json({ contact: mapContactRow(updated) });
  }

  if (method === 'DELETE') {
    db.prepare('DELETE FROM contacts WHERE id = ? AND owner_id = ?').run(
      id,
      auth.id
    );
    return json({ ok: true });
  }

  return null;
}

async function handleNotes(
  request: Request,
  id: string | undefined,
  method: string
): Promise<Response | null> {
  const auth = getAuthenticatedUser(request, method !== 'GET');
  if (isResponse(auth)) return auth;
  const db = getDb();

  if (!id && method === 'GET') {
    const rows = db
      .prepare('SELECT * FROM notes WHERE owner_id = ? ORDER BY created_at DESC')
      .all(auth.id) as Record<string, unknown>[];
    return json({ notes: rows.map(mapNoteRow) });
  }

  if (!id && method === 'POST') {
    const body = await readBody(request);
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const category =
      typeof body.category === 'string' && VALID_CATEGORIES.has(body.category)
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
      return json({ error: 'Note content is required.' }, 400);
    }
    if (leadId && !ownsRelatedRecord('leads', leadId, auth.id)) {
      return json({ error: 'Linked lead not found.' }, 404);
    }
    if (contactId && !ownsRelatedRecord('contacts', contactId, auth.id)) {
      return json({ error: 'Linked contact not found.' }, 404);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO notes (id, owner_id, lead_id, contact_id, title, content, category, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, auth.id, leadId, contactId, title, content, category, now);
    const created = db
      .prepare('SELECT * FROM notes WHERE id = ? AND owner_id = ?')
      .get(id, auth.id) as Record<string, unknown>;
    return json({ note: mapNoteRow(created) }, 201);
  }

  if (!id || method !== 'DELETE') return null;
  const info = db
    .prepare('DELETE FROM notes WHERE id = ? AND owner_id = ?')
    .run(id, auth.id);
  return info.changes
    ? json({ ok: true })
    : json({ error: 'Note not found.' }, 404);
}

async function handleTasks(
  request: Request,
  id: string | undefined,
  method: string
): Promise<Response | null> {
  const auth = getAuthenticatedUser(request, method !== 'GET');
  if (isResponse(auth)) return auth;
  const db = getDb();

  if (!id && method === 'GET') {
    const rows = db
      .prepare(
        'SELECT * FROM tasks WHERE owner_id = ? ORDER BY completed ASC, due_date ASC'
      )
      .all(auth.id) as Record<string, unknown>[];
    return json({ tasks: rows.map(mapTaskRow) });
  }

  if (!id && method === 'POST') {
    const body = await readBody(request);
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description =
      typeof body.description === 'string' ? body.description.trim() : '';
    const dueDate =
      typeof body.dueDate === 'string' && body.dueDate.trim()
        ? body.dueDate.trim().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const priority =
      typeof body.priority === 'string' && VALID_PRIORITIES.has(body.priority)
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
      return json(
        { error: 'Task title must be at least 2 characters.' },
        400
      );
    }
    if (leadId && !ownsRelatedRecord('leads', leadId, auth.id)) {
      return json({ error: 'Linked lead not found.' }, 404);
    }
    if (contactId && !ownsRelatedRecord('contacts', contactId, auth.id)) {
      return json({ error: 'Linked contact not found.' }, 404);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO tasks (id, owner_id, lead_id, contact_id, title, description, due_date, priority, completed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      auth.id,
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
      .get(id, auth.id) as Record<string, unknown>;
    return json({ task: mapTaskRow(created) }, 201);
  }

  if (!id || !ownsRelatedRecord('tasks', id, auth.id)) {
    return json({ error: 'Task not found.' }, 404);
  }

  if (method === 'PATCH') {
    const existing = db
      .prepare('SELECT * FROM tasks WHERE id = ? AND owner_id = ?')
      .get(id, auth.id) as Record<string, unknown>;
    const body = await readBody(request);
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
      typeof body.priority === 'string' && VALID_PRIORITIES.has(body.priority)
        ? String(body.priority)
        : String(existing.priority);
    const completed =
      typeof body.completed === 'boolean'
        ? body.completed
          ? 1
          : 0
        : Number(existing.completed);

    if (title.length < 2) {
      return json(
        { error: 'Task title must be at least 2 characters.' },
        400
      );
    }
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE tasks
       SET title = ?, description = ?, due_date = ?, priority = ?, completed = ?, updated_at = ?
       WHERE id = ? AND owner_id = ?`
    ).run(title, description, dueDate, priority, completed, now, id, auth.id);
    const updated = db
      .prepare('SELECT * FROM tasks WHERE id = ? AND owner_id = ?')
      .get(id, auth.id) as Record<string, unknown>;
    return json({ task: mapTaskRow(updated) });
  }

  if (method === 'DELETE') {
    const info = db
      .prepare('DELETE FROM tasks WHERE id = ? AND owner_id = ?')
      .run(id, auth.id);
    return info.changes
      ? json({ ok: true })
      : json({ error: 'Task not found.' }, 404);
  }

  return null;
}

export async function handleApiRequest(
  request: Request,
  segments: string[]
): Promise<Response> {
  try {
    const method = request.method.toUpperCase();
    const [resource, first, second] = segments;

    if (resource === 'health' && method === 'GET') {
      return json({ ok: true });
    }
    if (resource === 'auth') {
      const response = await handleAuth(request, first ?? '', method);
      if (response) return response;
    }
    if (resource === 'public') {
      const response = await handlePublic(request, first ?? '', method);
      if (response) return response;
    }
    if (resource === 'leads') {
      const response = await handleLeads(request, first, second, method);
      if (response) return response;
    }
    if (resource === 'contacts') {
      const response = await handleContacts(request, first, method);
      if (response) return response;
    }
    if (resource === 'notes') {
      const response = await handleNotes(request, first, method);
      if (response) return response;
    }
    if (resource === 'tasks') {
      const response = await handleTasks(request, first, method);
      if (response) return response;
    }

    return json({ error: 'API endpoint not found.' }, 404);
  } catch (error) {
    if (error instanceof ApiError) {
      return json({ error: error.message }, error.status);
    }
    console.error('API request failed:', error);
    return json({ error: 'Internal server error.' }, 500);
  }
}
