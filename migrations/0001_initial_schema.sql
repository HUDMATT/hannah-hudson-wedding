PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  household_name TEXT NOT NULL,
  primary_name TEXT,
  invite_code TEXT NOT NULL UNIQUE,
  phone TEXT,
  email TEXT,
  mailing_address TEXT,
  allowed_plus_ones INTEGER NOT NULL DEFAULT 0,
  tags TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  guest_type TEXT NOT NULL DEFAULT 'adult' CHECK (guest_type IN ('adult', 'child')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rsvps (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('attending', 'declined')),
  song_request TEXT,
  notes TEXT,
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rsvp_attendees (
  id TEXT PRIMARY KEY,
  rsvp_id TEXT NOT NULL,
  guest_id TEXT,
  full_name TEXT NOT NULL,
  attendee_type TEXT NOT NULL DEFAULT 'adult' CHECK (attendee_type IN ('adult', 'child', 'plus_one')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rsvp_id) REFERENCES rsvps(id) ON DELETE CASCADE,
  FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS guest_info_updates (
  id TEXT PRIMARY KEY,
  household_id TEXT,
  invite_code TEXT NOT NULL,
  submitted_name TEXT,
  submitted_phone TEXT,
  submitted_email TEXT,
  submitted_address TEXT,
  submitted_household_members TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS gallery_assets (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  title TEXT,
  alt_text TEXT,
  section TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_households_invite_code ON households(invite_code);
CREATE INDEX IF NOT EXISTS idx_households_email ON households(email);
CREATE INDEX IF NOT EXISTS idx_households_phone ON households(phone);
CREATE INDEX IF NOT EXISTS idx_guests_household_id ON guests(household_id);
CREATE INDEX IF NOT EXISTS idx_guests_full_name ON guests(full_name);
CREATE INDEX IF NOT EXISTS idx_rsvps_household_id ON rsvps(household_id);
CREATE INDEX IF NOT EXISTS idx_rsvp_attendees_rsvp_id ON rsvp_attendees(rsvp_id);
CREATE INDEX IF NOT EXISTS idx_gallery_assets_section ON gallery_assets(section);

