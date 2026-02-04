package db

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

var DB *sql.DB

func Init(dbPath string) error {
	// Ensure data directory exists
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	var err error
	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return err
	}

	// Enable foreign keys
	if _, err := DB.Exec("PRAGMA foreign_keys = ON"); err != nil {
		return err
	}

	if err := migrate(); err != nil {
		return err
	}

	log.Printf("Database initialized at %s", dbPath)
	return nil
}

func migrate() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS trainers (
			id TEXT PRIMARY KEY,
			telegram_user_id INTEGER UNIQUE NOT NULL,
			bot_token TEXT UNIQUE NOT NULL,
			bot_username TEXT NOT NULL,
			webhook_secret TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL,
			timezone TEXT DEFAULT 'Europe/Moscow',
			cancel_cutoff_hrs INTEGER DEFAULT 24,
			is_active BOOLEAN DEFAULT 1,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS clients (
			id TEXT PRIMARY KEY,
			telegram_user_id INTEGER NOT NULL,
			trainer_id TEXT NOT NULL REFERENCES trainers(id),
			name TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(telegram_user_id, trainer_id)
		)`,
		`CREATE TABLE IF NOT EXISTS session_types (
			id TEXT PRIMARY KEY,
			trainer_id TEXT NOT NULL REFERENCES trainers(id),
			type TEXT NOT NULL,
			name TEXT NOT NULL,
			duration_minutes INTEGER NOT NULL,
			price INTEGER NOT NULL,
			currency TEXT DEFAULT 'RUB',
			is_active BOOLEAN DEFAULT 1,
			UNIQUE(trainer_id, type)
		)`,
		`CREATE TABLE IF NOT EXISTS working_hours (
			id TEXT PRIMARY KEY,
			trainer_id TEXT NOT NULL REFERENCES trainers(id),
			day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
			start_time TEXT NOT NULL,
			end_time TEXT NOT NULL,
			UNIQUE(trainer_id, day_of_week)
		)`,
		`CREATE TABLE IF NOT EXISTS bookings (
			id TEXT PRIMARY KEY,
			trainer_id TEXT NOT NULL REFERENCES trainers(id),
			client_id TEXT NOT NULL REFERENCES clients(id),
			session_type_id TEXT NOT NULL REFERENCES session_types(id),
			starts_at DATETIME NOT NULL,
			ends_at DATETIME NOT NULL,
			client_name TEXT NOT NULL,
			client_message TEXT,
			status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected','cancelled','completed')),
			cancel_reason TEXT,
			cancelled_by TEXT CHECK(cancelled_by IN ('client','trainer') OR cancelled_by IS NULL),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_trainer_id ON bookings(trainer_id)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_starts_at ON bookings(starts_at)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`,
	}

	for _, migration := range migrations {
		if _, err := DB.Exec(migration); err != nil {
			return err
		}
	}

	return nil
}

func Close() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}
