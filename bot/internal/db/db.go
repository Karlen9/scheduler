package db

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	_ "modernc.org/sqlite"

	"scheduler-bot/internal/crypto"
)

var DB *sql.DB

// Init initializes the database connection. If databaseURL starts with "postgres",
// it connects to PostgreSQL; otherwise it treats the value as a SQLite file path.
func Init(databaseURL string) error {
	if strings.HasPrefix(databaseURL, "postgres") {
		return initPostgres(databaseURL)
	}
	return initSQLite(databaseURL)
}

func initSQLite(dbPath string) error {
	isPostgres = false

	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	var err error
	DB, err = sql.Open("sqlite", dbPath)
	if err != nil {
		return err
	}

	if _, err := DB.Exec("PRAGMA foreign_keys = ON"); err != nil {
		return err
	}

	if err := migrateSQLite(); err != nil {
		return err
	}

	log.Printf("Database initialized at %s (SQLite)", dbPath)
	return nil
}

func initPostgres(databaseURL string) error {
	isPostgres = true

	var err error
	DB, err = sql.Open("pgx", databaseURL)
	if err != nil {
		return err
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	if err := DB.Ping(); err != nil {
		return err
	}

	if err := migratePostgres(); err != nil {
		return err
	}

	log.Printf("Database initialized (PostgreSQL)")
	return nil
}

func migrateSQLite() error {
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
			is_active BOOLEAN DEFAULT 1
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
			status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected','cancelled','completed','cancel_requested','reschedule_pending')),
			cancel_reason TEXT,
			cancelled_by TEXT CHECK(cancelled_by IN ('client','trainer') OR cancelled_by IS NULL),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			replaces_booking_id TEXT
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
		`CREATE TABLE IF NOT EXISTS waitlist (
			id TEXT PRIMARY KEY,
			trainer_id TEXT NOT NULL,
			client_id TEXT NOT NULL,
			starts_at DATETIME NOT NULL,
			ends_at DATETIME NOT NULL,
			duration_minutes INTEGER NOT NULL,
			client_name TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'waiting'
				CHECK(status IN ('waiting','offered','booked','declined','expired','cancelled')),
			offered_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (trainer_id) REFERENCES trainers(id),
			FOREIGN KEY (client_id) REFERENCES clients(id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_waitlist_trainer_id ON waitlist(trainer_id)`,
		`CREATE INDEX IF NOT EXISTS idx_waitlist_client_id ON waitlist(client_id)`,
		`CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status)`,
		`CREATE TABLE IF NOT EXISTS recurring_schedules (
			id TEXT PRIMARY KEY,
			trainer_id TEXT NOT NULL REFERENCES trainers(id),
			client_id TEXT NOT NULL REFERENCES clients(id),
			client_name TEXT NOT NULL,
			day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
			time TEXT NOT NULL,
			duration_minutes INTEGER NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending'
				CHECK(status IN ('pending','active','declined','cancelled')),
			created_by TEXT NOT NULL CHECK(created_by IN ('client','trainer')),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			session_type_id TEXT,
			days_of_week TEXT,
			start_date TEXT,
			end_date TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_trainer_id ON recurring_schedules(trainer_id)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_client_id ON recurring_schedules(client_id)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_status ON recurring_schedules(status)`,
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
		`ALTER TABLE trainers ADD COLUMN available_durations TEXT`,
		`ALTER TABLE clients ADD COLUMN preferred_duration INTEGER DEFAULT 60`,
		`ALTER TABLE bookings ADD COLUMN duration_minutes INTEGER DEFAULT 60`,
		`ALTER TABLE clients ADD COLUMN notify_booking_status INTEGER DEFAULT 1`,
		`ALTER TABLE clients ADD COLUMN notify_reminders INTEGER DEFAULT 1`,
		`ALTER TABLE clients ADD COLUMN notify_days_off INTEGER DEFAULT 0`,
		`ALTER TABLE trainers ADD COLUMN notify_new_bookings INTEGER DEFAULT 1`,
		`ALTER TABLE trainers ADD COLUMN notify_cancellations INTEGER DEFAULT 1`,
		`ALTER TABLE clients ADD COLUMN notify_waitlist INTEGER DEFAULT 1`,
		`ALTER TABLE bookings ADD COLUMN created_by TEXT`,
		`ALTER TABLE bookings ADD COLUMN recurring_schedule_id TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN session_type_id TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN days_of_week TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN start_date TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN end_date TEXT`,
		`ALTER TABLE bookings ADD COLUMN replaces_booking_id TEXT`,
		`ALTER TABLE bookings ADD COLUMN telegram_notification_chat_id INTEGER`,
		`ALTER TABLE bookings ADD COLUMN telegram_notification_msg_id INTEGER`,
		`ALTER TABLE clients ADD COLUMN photo_url TEXT DEFAULT ''`,
		`ALTER TABLE clients ADD COLUMN notify_cancellations INTEGER DEFAULT 1`,
		`ALTER TABLE recurring_schedules ADD COLUMN day_times TEXT`,
		`ALTER TABLE session_types ADD COLUMN image_url TEXT DEFAULT ''`,
		`ALTER TABLE clients ADD COLUMN is_ghost INTEGER DEFAULT 0`,
		`ALTER TABLE trainers ADD COLUMN language TEXT DEFAULT 'ru'`,
		`ALTER TABLE clients ADD COLUMN language TEXT DEFAULT 'ru'`,
	}

	for _, migration := range alterMigrations {
		DB.Exec(migration) // Ignore errors for duplicate columns
	}

	// Create unique index on bot_token_hash (separate from alters since it's not ALTER TABLE)
	DB.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_trainers_bot_token_hash ON trainers(bot_token_hash)`)

	// Drop UNIQUE(trainer_id, type) constraint on session_types for existing databases
	// SQLite: must recreate table to remove constraint
	DB.Exec(`CREATE TABLE IF NOT EXISTS session_types_new (
		id TEXT PRIMARY KEY,
		trainer_id TEXT NOT NULL REFERENCES trainers(id),
		type TEXT NOT NULL,
		name TEXT NOT NULL,
		duration_minutes INTEGER NOT NULL,
		price INTEGER NOT NULL,
		currency TEXT DEFAULT 'RUB',
		is_active BOOLEAN DEFAULT 1,
		image_url TEXT DEFAULT ''
	)`)
	var stNewExists int
	DB.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='session_types_new'`).Scan(&stNewExists)
	if stNewExists > 0 {
		DB.Exec(`INSERT OR IGNORE INTO session_types_new SELECT id, trainer_id, type, name, duration_minutes, price, currency, is_active, image_url FROM session_types`)
		DB.Exec(`DROP TABLE session_types`)
		DB.Exec(`ALTER TABLE session_types_new RENAME TO session_types`)
	}

	// Recreate recurring_schedules to update CHECK constraint for existing databases
	// (new databases already have the correct CHECK from CREATE TABLE above)
	DB.Exec(`CREATE TABLE IF NOT EXISTS recurring_schedules_new (
		id TEXT PRIMARY KEY,
		trainer_id TEXT NOT NULL REFERENCES trainers(id),
		client_id TEXT NOT NULL REFERENCES clients(id),
		client_name TEXT NOT NULL,
		day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
		time TEXT NOT NULL,
		duration_minutes INTEGER NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending'
			CHECK(status IN ('pending','active','declined','cancelled')),
		created_by TEXT NOT NULL CHECK(created_by IN ('client','trainer')),
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		session_type_id TEXT,
		days_of_week TEXT,
		start_date TEXT,
		end_date TEXT
	)`)
	// Check if the new table was actually created (it won't exist if recurring_schedules already has the right schema)
	var newTableExists int
	DB.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='recurring_schedules_new'`).Scan(&newTableExists)
	if newTableExists > 0 {
		DB.Exec(`INSERT OR IGNORE INTO recurring_schedules_new SELECT id, trainer_id, client_id, client_name, day_of_week, time, duration_minutes, CASE WHEN status = 'paused' THEN 'active' ELSE status END, created_by, created_at, session_type_id, days_of_week, start_date, end_date FROM recurring_schedules`)
		DB.Exec(`DROP TABLE recurring_schedules`)
		DB.Exec(`ALTER TABLE recurring_schedules_new RENAME TO recurring_schedules`)
		DB.Exec(`CREATE INDEX IF NOT EXISTS idx_recurring_trainer_id ON recurring_schedules(trainer_id)`)
		DB.Exec(`CREATE INDEX IF NOT EXISTS idx_recurring_client_id ON recurring_schedules(client_id)`)
		DB.Exec(`CREATE INDEX IF NOT EXISTS idx_recurring_status ON recurring_schedules(status)`)
	}

	// Update bookings CHECK constraint for new statuses (cancel_requested, reschedule_pending)
	DB.Exec(`CREATE TABLE IF NOT EXISTS bookings_new (
		id TEXT PRIMARY KEY,
		trainer_id TEXT NOT NULL REFERENCES trainers(id),
		client_id TEXT NOT NULL REFERENCES clients(id),
		session_type_id TEXT NOT NULL REFERENCES session_types(id),
		starts_at DATETIME NOT NULL,
		ends_at DATETIME NOT NULL,
		client_name TEXT NOT NULL,
		client_message TEXT,
		status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected','cancelled','completed','cancel_requested','reschedule_pending')),
		cancel_reason TEXT,
		cancelled_by TEXT CHECK(cancelled_by IN ('client','trainer') OR cancelled_by IS NULL),
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		reminder_sent BOOLEAN DEFAULT 0,
		duration_minutes INTEGER DEFAULT 60,
		created_by TEXT,
		recurring_schedule_id TEXT,
		replaces_booking_id TEXT
	)`)
	var bookingsNewExists int
	DB.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='bookings_new'`).Scan(&bookingsNewExists)
	if bookingsNewExists > 0 {
		DB.Exec(`INSERT OR IGNORE INTO bookings_new SELECT id, trainer_id, client_id, session_type_id, starts_at, ends_at, client_name, client_message, status, cancel_reason, cancelled_by, created_at, reminder_sent, duration_minutes, created_by, recurring_schedule_id, replaces_booking_id FROM bookings`)
		DB.Exec(`DROP TABLE bookings`)
		DB.Exec(`ALTER TABLE bookings_new RENAME TO bookings`)
		DB.Exec(`CREATE INDEX IF NOT EXISTS idx_bookings_trainer_id ON bookings(trainer_id)`)
		DB.Exec(`CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id)`)
		DB.Exec(`CREATE INDEX IF NOT EXISTS idx_bookings_starts_at ON bookings(starts_at)`)
		DB.Exec(`CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`)
	}

	return nil
}

func migratePostgres() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS trainers (
			id TEXT PRIMARY KEY,
			telegram_user_id BIGINT UNIQUE NOT NULL,
			bot_token TEXT UNIQUE NOT NULL,
			bot_username TEXT NOT NULL,
			webhook_secret TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL,
			timezone TEXT DEFAULT 'Europe/Moscow',
			cancel_cutoff_hrs INTEGER DEFAULT 24,
			is_active INTEGER DEFAULT 1,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			telegram_handle TEXT,
			phone TEXT,
			specialization TEXT,
			bio TEXT,
			photo_url TEXT,
			bot_token_hash TEXT,
			gym_latitude DOUBLE PRECISION DEFAULT 0,
			gym_longitude DOUBLE PRECISION DEFAULT 0,
			gym_address TEXT,
			available_durations TEXT,
			notify_new_bookings INTEGER DEFAULT 1,
			notify_cancellations INTEGER DEFAULT 1
		)`,
		`CREATE TABLE IF NOT EXISTS clients (
			id TEXT PRIMARY KEY,
			telegram_user_id BIGINT NOT NULL,
			trainer_id TEXT NOT NULL REFERENCES trainers(id),
			name TEXT NOT NULL,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			phone TEXT,
			preferred_duration INTEGER DEFAULT 60,
			notify_booking_status INTEGER DEFAULT 1,
			notify_reminders INTEGER DEFAULT 1,
			notify_days_off INTEGER DEFAULT 0,
			notify_waitlist INTEGER DEFAULT 1,
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
			is_active INTEGER DEFAULT 1
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
			starts_at TIMESTAMPTZ NOT NULL,
			ends_at TIMESTAMPTZ NOT NULL,
			client_name TEXT NOT NULL,
			client_message TEXT,
			status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected','cancelled','completed','cancel_requested','reschedule_pending')),
			cancel_reason TEXT,
			cancelled_by TEXT CHECK(cancelled_by IN ('client','trainer') OR cancelled_by IS NULL),
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			reminder_sent INTEGER DEFAULT 0,
			duration_minutes INTEGER DEFAULT 60,
			created_by TEXT,
			recurring_schedule_id TEXT,
			replaces_booking_id TEXT
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
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(trainer_id, date)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_days_off_trainer_id ON days_off(trainer_id)`,
		`CREATE INDEX IF NOT EXISTS idx_days_off_date ON days_off(date)`,
		`CREATE TABLE IF NOT EXISTS waitlist (
			id TEXT PRIMARY KEY,
			trainer_id TEXT NOT NULL REFERENCES trainers(id),
			client_id TEXT NOT NULL REFERENCES clients(id),
			starts_at TIMESTAMPTZ NOT NULL,
			ends_at TIMESTAMPTZ NOT NULL,
			duration_minutes INTEGER NOT NULL,
			client_name TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'waiting'
				CHECK(status IN ('waiting','offered','booked','declined','expired','cancelled')),
			offered_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_waitlist_trainer_id ON waitlist(trainer_id)`,
		`CREATE INDEX IF NOT EXISTS idx_waitlist_client_id ON waitlist(client_id)`,
		`CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status)`,
		`CREATE TABLE IF NOT EXISTS recurring_schedules (
			id TEXT PRIMARY KEY,
			trainer_id TEXT NOT NULL REFERENCES trainers(id),
			client_id TEXT NOT NULL REFERENCES clients(id),
			client_name TEXT NOT NULL,
			day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
			"time" TEXT NOT NULL,
			duration_minutes INTEGER NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending'
				CHECK(status IN ('pending','active','declined','cancelled')),
			created_by TEXT NOT NULL CHECK(created_by IN ('client','trainer')),
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			session_type_id TEXT,
			days_of_week TEXT,
			start_date TEXT,
			end_date TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_trainer_id ON recurring_schedules(trainer_id)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_client_id ON recurring_schedules(client_id)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_status ON recurring_schedules(status)`,
	}

	for _, migration := range migrations {
		if _, err := DB.Exec(migration); err != nil {
			return err
		}
	}

	// Postgres ALTER TABLE migrations using ADD COLUMN IF NOT EXISTS
	alterMigrations := []string{
		`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS telegram_handle TEXT`,
		`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS phone TEXT`,
		`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS specialization TEXT`,
		`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS bio TEXT`,
		`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS photo_url TEXT`,
		`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS bot_token_hash TEXT`,
		`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS gym_latitude DOUBLE PRECISION DEFAULT 0`,
		`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS gym_longitude DOUBLE PRECISION DEFAULT 0`,
		`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS gym_address TEXT`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent INTEGER DEFAULT 0`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone TEXT`,
		`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS available_durations TEXT`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_duration INTEGER DEFAULT 60`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notify_booking_status INTEGER DEFAULT 1`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notify_reminders INTEGER DEFAULT 1`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notify_days_off INTEGER DEFAULT 0`,
		`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS notify_new_bookings INTEGER DEFAULT 1`,
		`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS notify_cancellations INTEGER DEFAULT 1`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notify_waitlist INTEGER DEFAULT 1`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by TEXT`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurring_schedule_id TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS session_type_id TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS days_of_week TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS start_date TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS end_date TEXT`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS replaces_booking_id TEXT`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS telegram_notification_chat_id BIGINT`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS telegram_notification_msg_id INTEGER`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT ''`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notify_cancellations INTEGER DEFAULT 1`,
		`ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS day_times TEXT`,
		`ALTER TABLE session_types ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT ''`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_ghost INTEGER DEFAULT 0`,
		`ALTER TABLE trainers ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ru'`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ru'`,
	}

	for _, migration := range alterMigrations {
		if _, err := DB.Exec(migration); err != nil {
			return err
		}
	}

	// Create unique index on bot_token_hash
	DB.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_trainers_bot_token_hash ON trainers(bot_token_hash)`)

	// Drop UNIQUE(trainer_id, type) constraint on session_types for existing databases
	DB.Exec(`ALTER TABLE session_types DROP CONSTRAINT IF EXISTS session_types_trainer_id_type_key`)
	DB.Exec(`DROP INDEX IF EXISTS session_types_trainer_id_type_key`)

	// Update CHECK constraint on recurring_schedules status for existing Postgres databases
	DB.Exec(`ALTER TABLE recurring_schedules DROP CONSTRAINT IF EXISTS recurring_schedules_status_check`)
	DB.Exec(`ALTER TABLE recurring_schedules ADD CONSTRAINT recurring_schedules_status_check CHECK(status IN ('pending','active','declined','cancelled'))`)
	DB.Exec(`UPDATE recurring_schedules SET status = 'active' WHERE status = 'paused'`)

	// Update CHECK constraint on bookings status for new statuses
	DB.Exec(`ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check`)
	DB.Exec(`ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK(status IN ('pending','confirmed','rejected','cancelled','completed','cancel_requested','reschedule_pending'))`)

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
			Q(`UPDATE trainers SET bot_token = ?, bot_token_hash = ? WHERE id = ?`),
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
