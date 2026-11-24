import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'crm.db');

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      company TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      company TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'Website Form',
      status TEXT NOT NULL DEFAULT 'new',
      value INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL DEFAULT 'medium',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      lead_id TEXT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      company TEXT NOT NULL DEFAULT '',
      role_title TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      lead_id TEXT,
      contact_id TEXT,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      created_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      lead_id TEXT,
      contact_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id);
    CREATE INDEX IF NOT EXISTS idx_notes_owner ON notes(owner_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_owner ON tasks(owner_id);
  `);

  dbInstance = db;
  return db;
}

function relativeIso(daysOffset: number, hourOffset = 1): string {
  const ms = Date.now() + daysOffset * 86400000 - hourOffset * 3600000;
  return new Date(ms).toISOString();
}

function relativeDate(daysOffset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysOffset);
  return date.toISOString().slice(0, 10);
}

export function seedWorkspaceData(db: DatabaseSync, ownerId: string): void {
  const existing = db
    .prepare('SELECT COUNT(*) AS cnt FROM leads WHERE owner_id = ?')
    .get(ownerId) as { cnt: number };
  if (existing && existing.cnt > 0) return;

  const leadIds = {
    clara: crypto.randomUUID(),
    marcus: crypto.randomUUID(),
    sophia: crypto.randomUUID(),
    devon: crypto.randomUUID(),
    hannah: crypto.randomUUID(),
    liam: crypto.randomUUID(),
    nadia: crypto.randomUUID(),
    omar: crypto.randomUUID(),
  };

  const insertLead = db.prepare(`
    INSERT INTO leads (id, owner_id, name, email, phone, company, source, status, value, priority, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedLeads = [
    [
      leadIds.clara,
      ownerId,
      'Clara Jensen',
      'clara@nordicpay.io',
      '+1 (415) 555-0148',
      'NordicPay Systems',
      'Website Form',
      'new',
      18500,
      'high',
      relativeIso(-1, 14),
      relativeIso(-1, 14),
    ],
    [
      leadIds.marcus,
      ownerId,
      'Marcus Vance',
      'm.vance@kestrellabs.co',
      '+1 (212) 555-0192',
      'Kestrel Labs',
      'Referral',
      'converted',
      32000,
      'high',
      relativeIso(-14, 9),
      relativeIso(-2, 16),
    ],
    [
      leadIds.sophia,
      ownerId,
      'Sophia Alverez',
      'sophia@vervecommerce.com',
      '+1 (310) 555-0164',
      'Verve Commerce',
      'Website Form',
      'contacted',
      14000,
      'high',
      relativeIso(-3, 11),
      relativeIso(-1, 17),
    ],
    [
      leadIds.devon,
      ownerId,
      'Devon Brooks',
      'dbrooks@harborfreighttech.com',
      '+1 (617) 555-0123',
      'Harbor Tech Group',
      'LinkedIn',
      'qualified',
      26000,
      'medium',
      relativeIso(-6, 15),
      relativeIso(-2, 10),
    ],
    [
      leadIds.hannah,
      ownerId,
      'Hannah Lindqvist',
      'hannah@studioforma.se',
      '+46 70 555 0181',
      'Studio Forma',
      'Partner',
      'proposal',
      21500,
      'high',
      relativeIso(-9, 8),
      relativeIso(-1, 12),
    ],
    [
      leadIds.liam,
      ownerId,
      'Liam O’Connor',
      'liam@oakridgehealth.org',
      '+1 (512) 555-0137',
      'Oakridge Health',
      'Cold Outreach',
      'converted',
      19800,
      'medium',
      relativeIso(-18, 13),
      relativeIso(-4, 15),
    ],
    [
      leadIds.nadia,
      ownerId,
      'Nadia Patel',
      'nadia@brightgrid.energy',
      '+1 (404) 555-0155',
      'BrightGrid Energy',
      'Event',
      'new',
      11500,
      'medium',
      relativeIso(0, 9),
      relativeIso(0, 9),
    ],
    [
      leadIds.omar,
      ownerId,
      'Omar Haddad',
      'omar@cedarlogistics.net',
      '+1 (305) 555-0119',
      'Cedar Logistics',
      'Cold Outreach',
      'lost',
      9000,
      'low',
      relativeIso(-22, 11),
      relativeIso(-7, 14),
    ],
  ];

  for (const row of seedLeads) {
    insertLead.run(...row);
  }

  const contactIds = {
    marcus: crypto.randomUUID(),
    liam: crypto.randomUUID(),
    hannah: crypto.randomUUID(),
    devon: crypto.randomUUID(),
    sophia: crypto.randomUUID(),
  };

  const insertContact = db.prepare(`
    INSERT INTO contacts (id, owner_id, lead_id, name, email, phone, company, role_title, location, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedContacts = [
    [
      contactIds.marcus,
      ownerId,
      leadIds.marcus,
      'Marcus Vance',
      'm.vance@kestrellabs.co',
      '+1 (212) 555-0192',
      'Kestrel Labs',
      'VP of Operations',
      'New York, NY',
      relativeIso(-12, 10),
      relativeIso(-2, 16),
    ],
    [
      contactIds.liam,
      ownerId,
      leadIds.liam,
      'Liam O’Connor',
      'liam@oakridgehealth.org',
      '+1 (512) 555-0137',
      'Oakridge Health',
      'Director of Digital Systems',
      'Austin, TX',
      relativeIso(-15, 11),
      relativeIso(-4, 15),
    ],
    [
      contactIds.hannah,
      ownerId,
      leadIds.hannah,
      'Hannah Lindqvist',
      'hannah@studioforma.se',
      '+46 70 555 0181',
      'Studio Forma',
      'Managing Partner',
      'Stockholm, SE',
      relativeIso(-7, 9),
      relativeIso(-1, 12),
    ],
    [
      contactIds.devon,
      ownerId,
      leadIds.devon,
      'Devon Brooks',
      'dbrooks@harborfreighttech.com',
      '+1 (617) 555-0123',
      'Harbor Tech Group',
      'Head of Product',
      'Boston, MA',
      relativeIso(-5, 15),
      relativeIso(-2, 10),
    ],
    [
      contactIds.sophia,
      ownerId,
      leadIds.sophia,
      'Sophia Alverez',
      'sophia@vervecommerce.com',
      '+1 (310) 555-0164',
      'Verve Commerce',
      'Growth Lead',
      'Los Angeles, CA',
      relativeIso(-2, 11),
      relativeIso(-1, 17),
    ],
  ];

  for (const row of seedContacts) {
    insertContact.run(...row);
  }

  const insertNote = db.prepare(`
    INSERT INTO notes (id, owner_id, lead_id, contact_id, title, content, category, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedNotes = [
    [
      crypto.randomUUID(),
      ownerId,
      leadIds.clara,
      null,
      'Website inquiry context',
      'Submitted intake form requesting a customer portal redesign and billing integration ahead of Q1 launch.',
      'General',
      relativeIso(-1, 14),
    ],
    [
      crypto.randomUUID(),
      ownerId,
      leadIds.sophia,
      contactIds.sophia,
      'Intro discovery call notes',
      'Confirmed 6-week timeline and $14k budget cap. Needs Shopify checkout analytics and automated invoice exports.',
      'Call',
      relativeIso(-1, 17),
    ],
    [
      crypto.randomUUID(),
      ownerId,
      leadIds.hannah,
      contactIds.hannah,
      'Proposal feedback',
      'Hannah reviewed Phase 1 & Phase 2 milestone schedule. Requested fixed-fee option for design system handoff.',
      'Proposal',
      relativeIso(-1, 12),
    ],
    [
      crypto.randomUUID(),
      ownerId,
      leadIds.devon,
      contactIds.devon,
      'Technical architecture walkthrough',
      'Stakeholders aligned on REST API milestones and role-based access control requirements.',
      'Meeting',
      relativeIso(-2, 10),
    ],
    [
      crypto.randomUUID(),
      ownerId,
      leadIds.marcus,
      contactIds.marcus,
      'Signed MSA & kickoff scheduled',
      'Retainer agreement executed for 4 months. Finance team received W-9 and initial deposit invoice.',
      'Follow-up',
      relativeIso(-2, 16),
    ],
    [
      crypto.randomUUID(),
      ownerId,
      leadIds.liam,
      contactIds.liam,
      'Quarterly check-in',
      'Client team happy with onboarding speed; discussed potential Phase 2 patient scheduling module.',
      'Meeting',
      relativeIso(-4, 15),
    ],
  ];

  for (const row of seedNotes) {
    insertNote.run(...row);
  }

  const insertTask = db.prepare(`
    INSERT INTO tasks (id, owner_id, lead_id, contact_id, title, description, due_date, priority, completed, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedTasks = [
    [
      crypto.randomUUID(),
      ownerId,
      leadIds.clara,
      null,
      'Send initial response & calendar link to Clara Jensen',
      'Reply to NordicPay website inquiry with 2 discovery slots.',
      relativeDate(-1),
      'high',
      0,
      relativeIso(-1, 15),
      relativeIso(-1, 15),
    ],
    [
      crypto.randomUUID(),
      ownerId,
      leadIds.hannah,
      contactIds.hannah,
      'Revise Studio Forma proposal with fixed-fee tier',
      'Update Section 3 pricing and attach delivery schedule.',
      relativeDate(-2),
      'high',
      0,
      relativeIso(-3, 9),
      relativeIso(-1, 12),
    ],
    [
      crypto.randomUUID(),
      ownerId,
      leadIds.sophia,
      contactIds.sophia,
      'Share Verve Commerce scope checklist',
      'Send technical requirements sheet before Friday review.',
      relativeDate(2),
      'medium',
      0,
      relativeIso(-1, 18),
      relativeIso(-1, 18),
    ],
    [
      crypto.randomUUID(),
      ownerId,
      leadIds.devon,
      contactIds.devon,
      'Prepare Harbor Tech security & SLA overview',
      'Include uptime commitments and RBAC summary.',
      relativeDate(4),
      'medium',
      0,
      relativeIso(-2, 11),
      relativeIso(-2, 11),
    ],
    [
      crypto.randomUUID(),
      ownerId,
      leadIds.nadia,
      null,
      'Qualify BrightGrid Energy event lead',
      'Confirm project timeline and decision-maker.',
      relativeDate(1),
      'low',
      0,
      relativeIso(0, 9),
      relativeIso(0, 9),
    ],
    [
      crypto.randomUUID(),
      ownerId,
      leadIds.marcus,
      contactIds.marcus,
      'Send onboarding welcome kit to Kestrel Labs',
      'Shared repository access and weekly sync invite.',
      relativeDate(-3),
      'medium',
      1,
      relativeIso(-4, 10),
      relativeIso(-2, 16),
    ],
  ];

  for (const row of seedTasks) {
    insertTask.run(...row);
  }
}
