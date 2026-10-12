CREATE TABLE IF NOT EXISTS paper_signals (
 id TEXT PRIMARY KEY, symbol TEXT NOT NULL,
 signal TEXT NOT NULL CHECK(signal IN ('LONG','SHORT','WAIT')),
 confidence REAL NOT NULL CHECK(confidence BETWEEN 0 AND 100),
 reason TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS paper_positions (
 id TEXT PRIMARY KEY,
 signal_id TEXT NOT NULL REFERENCES paper_signals(id),
 symbol TEXT NOT NULL,
 side TEXT NOT NULL CHECK(side IN ('LONG','SHORT')),
 status TEXT NOT NULL CHECK(status IN ('OPEN','CLOSED')),
 entry REAL NOT NULL, mark REAL NOT NULL, exit REAL,
 qty REAL NOT NULL, margin REAL NOT NULL, leverage INTEGER NOT NULL,
 entry_fee REAL NOT NULL, exit_fee REAL NOT NULL DEFAULT 0,
 funding_paid REAL NOT NULL DEFAULT 0, net REAL,
 opened_at INTEGER NOT NULL, closed_at INTEGER
);
CREATE TABLE IF NOT EXISTS paper_events (
 id TEXT PRIMARY KEY,
 position_id TEXT NOT NULL REFERENCES paper_positions(id),
 event_type TEXT NOT NULL CHECK(event_type IN ('OPEN','MARK','FUNDING','CLOSE')),
 price REAL, rate REAL, payment REAL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_paper_signals_time ON paper_signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paper_positions_status ON paper_positions(status,opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_paper_events_position ON paper_events(position_id,created_at DESC);
