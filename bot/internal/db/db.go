package db

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"

	"scheduler-bot/internal/crypto"
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
		`CREATE TABLE IF NOT EXISTS days_off (
			id TEXT PRIMARY KEY,
			trainer_id TEXT NOT NULL REFERENCES trainers(id),
			date DATE NOT NULL,
			reason TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(trainer_id, date)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_days_off_trainer_id ON days_off(trainer_id)`,
		`CREATE INDEX IF NOT EXISTS idx_days_off_date ON days_off(date)`,
	}

	for _, migration := range migrations {
		if _, err := DB.Exec(migration); err != nil {
			return err
		}
	}

	// Run ALTER TABLE migrations (ignore "duplicate column" errors)
	alterMigrations := []string{
		`ALTER TABLE trainers ADD COLUMN telegram_handle TEXT`,
		`ALTER TABLE trainers ADD COLUMN phone TEXT`,
		`ALTER TABLE trainers ADD COLUMN specialization TEXT`,
		`ALTER TABLE trainers ADD COLUMN bio TEXT`,
		`ALTER TABLE trainers ADD COLUMN photo_url TEXT`,
		`ALTER TABLE trainers ADD COLUMN bot_token_hash TEXT`,
		`ALTER TABLE trainers ADD COLUMN gym_latitude REAL DEFAULT 0`,
		`ALTER TABLE trainers ADD COLUMN gym_longitude REAL DEFAULT 0`,
		`ALTER TABLE trainers ADD COLUMN gym_address TEXT`,
		`ALTER TABLE bookings ADD COLUMN reminder_sent BOOLEAN DEFAULT 0`,
		`ALTER TABLE clients ADD COLUMN phone TEXT`,
	}

	for _, migration := range alterMigrations {
		DB.Exec(migration) // Ignore errors for duplicate columns
	}

	// Create unique index on bot_token_hash (separate from alters since it's not ALTER TABLE)
	DB.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_trainers_bot_token_hash ON trainers(bot_token_hash)`)

	return nil
}

func Close() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}

// MigrateEncryptTokens encrypts any plain-text bot tokens and populates bot_token_hash.
// Idempotent: skips rows that are already encrypted with a correct hash.
func MigrateEncryptTokens() error {
	rows, err := DB.Query(`SELECT id, bot_token, bot_token_hash FROM trainers`)
	if err != nil {
		return err
	}
	defer rows.Close()

	type row struct {
		id       string
		token    string
		hash     sql.NullString
	}
	var toMigrate []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.id, &r.token, &r.hash); err != nil {
			return err
		}
		toMigrate = append(toMigrate, r)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	migrated := 0
	for _, r := range toMigrate {
		// Determine the plain token for hashing
		plainToken, err := crypto.Decrypt(r.token)
		if err != nil {
			return err
		}

		expectedHash := crypto.HashToken(plainToken)

		// Skip if already encrypted with correct hash
		if crypto.IsEncrypted(r.token) && r.hash.Valid && r.hash.String == expectedHash {
			continue
		}

		// Encrypt the token (no-op if encryption is disabled)
		encrypted, err := crypto.Encrypt(plainToken)
		if err != nil {
			return err
		}

		if _, err := DB.Exec(
			`UPDATE trainers SET bot_token = ?, bot_token_hash = ? WHERE id = ?`,
			encrypted, expectedHash, r.id,
		); err != nil {
			return err
		}
		migrated++
	}

	if migrated > 0 {
		log.Printf("Migrated %d trainer token(s) (encrypted + hashed)", migrated)
	}
	return nil
}
