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
	// Rename migrations for databases created before the universal naming refactor
	renameMigrations := []string{
		`ALTER TABLE trainers RENAME TO specialists`,
		`ALTER TABLE specialists RENAME COLUMN gym_latitude TO location_latitude`,
		`ALTER TABLE specialists RENAME COLUMN gym_longitude TO location_longitude`,
		`ALTER TABLE specialists RENAME COLUMN gym_address TO location_address`,
		`ALTER TABLE bookings RENAME COLUMN trainer_id TO specialist_id`,
		`ALTER TABLE clients RENAME COLUMN trainer_id TO specialist_id`,
		`ALTER TABLE working_hours RENAME COLUMN trainer_id TO specialist_id`,
		`ALTER TABLE session_types RENAME COLUMN trainer_id TO specialist_id`,
		`ALTER TABLE days_off RENAME COLUMN trainer_id TO specialist_id`,
		`ALTER TABLE recurring_schedules RENAME COLUMN trainer_id TO specialist_id`,
	}
	for _, migration := range renameMigrations {
		DB.Exec(migration)
	}

	migrations := []string{
		`CREATE TABLE IF NOT EXISTS specialists (
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
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			name TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(telegram_user_id, specialist_id)
		)`,
		`CREATE TABLE IF NOT EXISTS session_types (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			type TEXT NOT NULL,
			name TEXT NOT NULL,
			duration_minutes INTEGER NOT NULL,
			price INTEGER NOT NULL,
			currency TEXT DEFAULT 'RUB',
			is_active BOOLEAN DEFAULT 1
		)`,
		`CREATE TABLE IF NOT EXISTS working_hours (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
			start_time TEXT NOT NULL,
			end_time TEXT NOT NULL,
			UNIQUE(specialist_id, day_of_week)
		)`,
		`CREATE TABLE IF NOT EXISTS bookings (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			client_id TEXT NOT NULL REFERENCES clients(id),
			session_type_id TEXT NOT NULL REFERENCES session_types(id),
			starts_at DATETIME NOT NULL,
			ends_at DATETIME NOT NULL,
			client_name TEXT NOT NULL,
			client_message TEXT,
			status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected','cancelled','completed','cancel_requested','reschedule_pending')),
			cancel_reason TEXT,
			cancelled_by TEXT CHECK(cancelled_by IN ('client','specialist') OR cancelled_by IS NULL),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			replaces_booking_id TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_specialist_id ON bookings(specialist_id)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_starts_at ON bookings(starts_at)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`,
		`CREATE TABLE IF NOT EXISTS days_off (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			date DATE NOT NULL,
			reason TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(specialist_id, date)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_days_off_specialist_id ON days_off(specialist_id)`,
		`CREATE INDEX IF NOT EXISTS idx_days_off_date ON days_off(date)`,
		`CREATE TABLE IF NOT EXISTS recurring_schedules (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			client_id TEXT NOT NULL REFERENCES clients(id),
			client_name TEXT NOT NULL,
			day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
			time TEXT NOT NULL,
			duration_minutes INTEGER NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending'
				CHECK(status IN ('pending','active','declined','cancelled')),
			created_by TEXT NOT NULL CHECK(created_by IN ('client','specialist')),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			session_type_id TEXT,
			days_of_week TEXT,
			start_date TEXT,
			end_date TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_specialist_id ON recurring_schedules(specialist_id)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_client_id ON recurring_schedules(client_id)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_status ON recurring_schedules(status)`,
	}

	for _, migration := range migrations {
		if _, err := DB.Exec(migration); err != nil {
			return err
		}
	}

	// ADD COLUMN migrations (ignore "duplicate column" errors)
	alterMigrations := []string{
		`ALTER TABLE specialists ADD COLUMN telegram_handle TEXT`,
		`ALTER TABLE specialists ADD COLUMN phone TEXT`,
		`ALTER TABLE specialists ADD COLUMN specialization TEXT`,
		`ALTER TABLE specialists ADD COLUMN bio TEXT`,
		`ALTER TABLE specialists ADD COLUMN photo_url TEXT`,
		`ALTER TABLE specialists ADD COLUMN bot_token_hash TEXT`,
		`ALTER TABLE specialists ADD COLUMN location_latitude REAL DEFAULT 0`,
		`ALTER TABLE specialists ADD COLUMN location_longitude REAL DEFAULT 0`,
		`ALTER TABLE specialists ADD COLUMN location_address TEXT`,
		`ALTER TABLE specialists ADD COLUMN available_durations TEXT`,
		`ALTER TABLE specialists ADD COLUMN notify_new_bookings INTEGER DEFAULT 1`,
		`ALTER TABLE specialists ADD COLUMN notify_cancellations INTEGER DEFAULT 1`,
		`ALTER TABLE specialists ADD COLUMN language TEXT DEFAULT 'ru'`,
		`ALTER TABLE clients ADD COLUMN phone TEXT`,
		`ALTER TABLE clients ADD COLUMN preferred_duration INTEGER DEFAULT 60`,
		`ALTER TABLE clients ADD COLUMN notify_booking_status INTEGER DEFAULT 1`,
		`ALTER TABLE clients ADD COLUMN notify_reminders INTEGER DEFAULT 1`,
		`ALTER TABLE clients ADD COLUMN notify_days_off INTEGER DEFAULT 0`,
		`ALTER TABLE clients ADD COLUMN notify_cancellations INTEGER DEFAULT 1`,
		`ALTER TABLE clients ADD COLUMN photo_url TEXT DEFAULT ''`,
		`ALTER TABLE clients ADD COLUMN is_ghost INTEGER DEFAULT 0`,
		`ALTER TABLE clients ADD COLUMN language TEXT DEFAULT 'ru'`,
		`ALTER TABLE clients ADD COLUMN display_name TEXT DEFAULT ''`,
		`ALTER TABLE bookings ADD COLUMN reminder_sent BOOLEAN DEFAULT 0`,
		`ALTER TABLE bookings ADD COLUMN duration_minutes INTEGER DEFAULT 60`,
		`ALTER TABLE bookings ADD COLUMN created_by TEXT`,
		`ALTER TABLE bookings ADD COLUMN recurring_schedule_id TEXT`,
		`ALTER TABLE bookings ADD COLUMN replaces_booking_id TEXT`,
		`ALTER TABLE bookings ADD COLUMN telegram_notification_chat_id INTEGER`,
		`ALTER TABLE bookings ADD COLUMN telegram_notification_msg_id INTEGER`,
		`ALTER TABLE recurring_schedules ADD COLUMN session_type_id TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN days_of_week TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN start_date TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN end_date TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN day_times TEXT`,
		`ALTER TABLE session_types ADD COLUMN image_url TEXT DEFAULT ''`,
	}

	for _, migration := range alterMigrations {
		DB.Exec(migration)
	}

	DB.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_specialists_bot_token_hash ON specialists(bot_token_hash)`)

	migrateTrainerEnumSQLite()

	return nil
}

func migratePostgres() error {
	// Rename migrations for databases created before the universal naming refactor
	renameMigrations := []string{
		`ALTER TABLE IF EXISTS trainers RENAME TO specialists`,
		`ALTER TABLE IF EXISTS specialists RENAME COLUMN gym_latitude TO location_latitude`,
		`ALTER TABLE IF EXISTS specialists RENAME COLUMN gym_longitude TO location_longitude`,
		`ALTER TABLE IF EXISTS specialists RENAME COLUMN gym_address TO location_address`,
		`ALTER TABLE IF EXISTS bookings RENAME COLUMN trainer_id TO specialist_id`,
		`ALTER TABLE IF EXISTS clients RENAME COLUMN trainer_id TO specialist_id`,
		`ALTER TABLE IF EXISTS working_hours RENAME COLUMN trainer_id TO specialist_id`,
		`ALTER TABLE IF EXISTS session_types RENAME COLUMN trainer_id TO specialist_id`,
		`ALTER TABLE IF EXISTS days_off RENAME COLUMN trainer_id TO specialist_id`,
		`ALTER TABLE IF EXISTS recurring_schedules RENAME COLUMN trainer_id TO specialist_id`,
	}
	for _, migration := range renameMigrations {
		DB.Exec(migration)
	}

	migrations := []string{
		`CREATE TABLE IF NOT EXISTS specialists (
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
			location_latitude DOUBLE PRECISION DEFAULT 0,
			location_longitude DOUBLE PRECISION DEFAULT 0,
			location_address TEXT,
			available_durations TEXT,
			notify_new_bookings INTEGER DEFAULT 1,
			notify_cancellations INTEGER DEFAULT 1
		)`,
		`CREATE TABLE IF NOT EXISTS clients (
			id TEXT PRIMARY KEY,
			telegram_user_id BIGINT NOT NULL,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			name TEXT NOT NULL,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			phone TEXT,
			preferred_duration INTEGER DEFAULT 60,
			notify_booking_status INTEGER DEFAULT 1,
			notify_reminders INTEGER DEFAULT 1,
			notify_days_off INTEGER DEFAULT 0,
			UNIQUE(telegram_user_id, specialist_id)
		)`,
		`CREATE TABLE IF NOT EXISTS session_types (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			type TEXT NOT NULL,
			name TEXT NOT NULL,
			duration_minutes INTEGER NOT NULL,
			price INTEGER NOT NULL,
			currency TEXT DEFAULT 'RUB',
			is_active INTEGER DEFAULT 1
		)`,
		`CREATE TABLE IF NOT EXISTS working_hours (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
			start_time TEXT NOT NULL,
			end_time TEXT NOT NULL,
			UNIQUE(specialist_id, day_of_week)
		)`,
		`CREATE TABLE IF NOT EXISTS bookings (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			client_id TEXT NOT NULL REFERENCES clients(id),
			session_type_id TEXT NOT NULL REFERENCES session_types(id),
			starts_at TIMESTAMPTZ NOT NULL,
			ends_at TIMESTAMPTZ NOT NULL,
			client_name TEXT NOT NULL,
			client_message TEXT,
			status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected','cancelled','completed','cancel_requested','reschedule_pending')),
			cancel_reason TEXT,
			cancelled_by TEXT CHECK(cancelled_by IN ('client','specialist') OR cancelled_by IS NULL),
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			reminder_sent INTEGER DEFAULT 0,
			duration_minutes INTEGER DEFAULT 60,
			created_by TEXT,
			recurring_schedule_id TEXT,
			replaces_booking_id TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_specialist_id ON bookings(specialist_id)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_starts_at ON bookings(starts_at)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`,
		`CREATE TABLE IF NOT EXISTS days_off (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			date DATE NOT NULL,
			reason TEXT,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(specialist_id, date)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_days_off_specialist_id ON days_off(specialist_id)`,
		`CREATE INDEX IF NOT EXISTS idx_days_off_date ON days_off(date)`,
		`CREATE TABLE IF NOT EXISTS recurring_schedules (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			client_id TEXT NOT NULL REFERENCES clients(id),
			client_name TEXT NOT NULL,
			day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
			"time" TEXT NOT NULL,
			duration_minutes INTEGER NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending'
				CHECK(status IN ('pending','active','declined','cancelled')),
			created_by TEXT NOT NULL CHECK(created_by IN ('client','specialist')),
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			session_type_id TEXT,
			days_of_week TEXT,
			start_date TEXT,
			end_date TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_specialist_id ON recurring_schedules(specialist_id)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_client_id ON recurring_schedules(client_id)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_status ON recurring_schedules(status)`,
	}

	for _, migration := range migrations {
		if _, err := DB.Exec(migration); err != nil {
			return err
		}
	}

	// ADD COLUMN IF NOT EXISTS migrations
	alterMigrations := []string{
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS telegram_handle TEXT`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS phone TEXT`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS specialization TEXT`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS bio TEXT`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS photo_url TEXT`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS bot_token_hash TEXT`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS location_latitude DOUBLE PRECISION DEFAULT 0`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS location_longitude DOUBLE PRECISION DEFAULT 0`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS location_address TEXT`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS available_durations TEXT`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS notify_new_bookings INTEGER DEFAULT 1`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS notify_cancellations INTEGER DEFAULT 1`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ru'`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone TEXT`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_duration INTEGER DEFAULT 60`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notify_booking_status INTEGER DEFAULT 1`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notify_reminders INTEGER DEFAULT 1`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notify_days_off INTEGER DEFAULT 0`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notify_cancellations INTEGER DEFAULT 1`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT ''`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_ghost INTEGER DEFAULT 0`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ru'`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS display_name TEXT DEFAULT ''`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent INTEGER DEFAULT 0`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by TEXT`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurring_schedule_id TEXT`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS replaces_booking_id TEXT`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS telegram_notification_chat_id BIGINT`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS telegram_notification_msg_id INTEGER`,
		`ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS session_type_id TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS days_of_week TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS start_date TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS end_date TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS day_times TEXT`,
		`ALTER TABLE session_types ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT ''`,
	}

	for _, migration := range alterMigrations {
		if _, err := DB.Exec(migration); err != nil {
			return err
		}
	}

	DB.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_specialists_bot_token_hash ON specialists(bot_token_hash)`)

	migrateTrainerEnumPostgres()

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
	rows, err := DB.Query(`SELECT id, bot_token, bot_token_hash FROM specialists`)
	if err != nil {
		return err
	}
	defer rows.Close()

	type row struct {
		id    string
		token string
		hash  sql.NullString
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
		plainToken, err := crypto.Decrypt(r.token)
		if err != nil {
			return err
		}

		expectedHash := crypto.HashToken(plainToken)

		if crypto.IsEncrypted(r.token) && r.hash.Valid && r.hash.String == expectedHash {
			continue
		}

		encrypted, err := crypto.Encrypt(plainToken)
		if err != nil {
			return err
		}

		if _, err := DB.Exec(
			Q(`UPDATE specialists SET bot_token = ?, bot_token_hash = ? WHERE id = ?`),
			encrypted, expectedHash, r.id,
		); err != nil {
			return err
		}
		migrated++
	}

	if migrated > 0 {
		log.Printf("Migrated %d specialist token(s) (encrypted + hashed)", migrated)
	}
	return nil
}

// migrateTrainerEnumSQLite rebuilds bookings and recurring_schedules tables to update
// CHECK constraints and data from 'trainer' to 'specialist'.
func migrateTrainerEnumSQLite() {
	var bookingsSQL string
	if err := DB.QueryRow(`SELECT sql FROM sqlite_master WHERE type='table' AND name='bookings'`).Scan(&bookingsSQL); err != nil {
		return
	}
	if !strings.Contains(bookingsSQL, "'trainer'") {
		return // Already migrated or fresh install
	}

	log.Println("Migrating 'trainer' enum values to 'specialist' in SQLite...")

	// PRAGMA foreign_keys cannot be changed inside a transaction
	DB.Exec(`PRAGMA foreign_keys=off`)

	tx, err := DB.Begin()
	if err != nil {
		log.Printf("Migration error (begin tx): %v", err)
		DB.Exec(`PRAGMA foreign_keys=on`)
		return
	}

	stmts := []string{
		// --- Rebuild bookings table ---
		`CREATE TABLE bookings_new (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			client_id TEXT NOT NULL REFERENCES clients(id),
			session_type_id TEXT NOT NULL REFERENCES session_types(id),
			starts_at DATETIME NOT NULL,
			ends_at DATETIME NOT NULL,
			client_name TEXT NOT NULL,
			client_message TEXT,
			status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected','cancelled','completed','cancel_requested','reschedule_pending')),
			cancel_reason TEXT,
			cancelled_by TEXT CHECK(cancelled_by IN ('client','specialist') OR cancelled_by IS NULL),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			replaces_booking_id TEXT,
			reminder_sent BOOLEAN DEFAULT 0,
			duration_minutes INTEGER DEFAULT 60,
			created_by TEXT,
			recurring_schedule_id TEXT,
			telegram_notification_chat_id INTEGER,
			telegram_notification_msg_id INTEGER
		)`,
		`INSERT INTO bookings_new (id, specialist_id, client_id, session_type_id, starts_at, ends_at,
			client_name, client_message, status, cancel_reason, cancelled_by, created_at,
			replaces_booking_id, reminder_sent, duration_minutes, created_by, recurring_schedule_id,
			telegram_notification_chat_id, telegram_notification_msg_id)
		SELECT id, specialist_id, client_id, session_type_id, starts_at, ends_at,
			client_name, client_message, status, cancel_reason,
			CASE cancelled_by WHEN 'trainer' THEN 'specialist' ELSE cancelled_by END,
			created_at, replaces_booking_id, reminder_sent, duration_minutes,
			CASE created_by WHEN 'trainer' THEN 'specialist' ELSE created_by END,
			recurring_schedule_id, telegram_notification_chat_id, telegram_notification_msg_id
		FROM bookings`,
		`DROP TABLE bookings`,
		`ALTER TABLE bookings_new RENAME TO bookings`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_specialist_id ON bookings(specialist_id)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_starts_at ON bookings(starts_at)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`,

		// --- Rebuild recurring_schedules table ---
		`CREATE TABLE recurring_schedules_new (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			client_id TEXT NOT NULL REFERENCES clients(id),
			client_name TEXT NOT NULL,
			day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
			"time" TEXT NOT NULL,
			duration_minutes INTEGER NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending'
				CHECK(status IN ('pending','active','declined','cancelled')),
			created_by TEXT NOT NULL CHECK(created_by IN ('client','specialist')),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			session_type_id TEXT,
			days_of_week TEXT,
			start_date TEXT,
			end_date TEXT,
			day_times TEXT
		)`,
		`INSERT INTO recurring_schedules_new (id, specialist_id, client_id, client_name, day_of_week, "time",
			duration_minutes, status, created_by, created_at, session_type_id, days_of_week,
			start_date, end_date, day_times)
		SELECT id, specialist_id, client_id, client_name, day_of_week, "time",
			duration_minutes, status,
			CASE created_by WHEN 'trainer' THEN 'specialist' ELSE created_by END,
			created_at, session_type_id, days_of_week, start_date, end_date, day_times
		FROM recurring_schedules`,
		`DROP TABLE recurring_schedules`,
		`ALTER TABLE recurring_schedules_new RENAME TO recurring_schedules`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_specialist_id ON recurring_schedules(specialist_id)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_client_id ON recurring_schedules(client_id)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_status ON recurring_schedules(status)`,
	}

	for _, stmt := range stmts {
		if _, err := tx.Exec(stmt); err != nil {
			log.Printf("Migration error, rolling back: %v", err)
			tx.Rollback()
			DB.Exec(`PRAGMA foreign_keys=on`)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		log.Printf("Migration commit error: %v", err)
		DB.Exec(`PRAGMA foreign_keys=on`)
		return
	}

	DB.Exec(`PRAGMA foreign_keys=on`)
	log.Println("Migration complete: 'trainer' → 'specialist' enum values updated (SQLite)")
}

// migrateTrainerEnumPostgres updates CHECK constraints and data from 'trainer' to 'specialist'.
func migrateTrainerEnumPostgres() {
	// Dynamically find and drop old CHECK constraints that reference 'trainer'
	DB.Exec(`
		DO $$
		DECLARE c_name TEXT;
		BEGIN
			SELECT conname INTO c_name FROM pg_constraint
			WHERE conrelid = 'bookings'::regclass AND contype = 'c'
			AND pg_get_constraintdef(oid) LIKE '%cancelled_by%trainer%';
			IF c_name IS NOT NULL THEN
				EXECUTE 'ALTER TABLE bookings DROP CONSTRAINT ' || quote_ident(c_name);
			END IF;

			SELECT conname INTO c_name FROM pg_constraint
			WHERE conrelid = 'recurring_schedules'::regclass AND contype = 'c'
			AND pg_get_constraintdef(oid) LIKE '%created_by%trainer%';
			IF c_name IS NOT NULL THEN
				EXECUTE 'ALTER TABLE recurring_schedules DROP CONSTRAINT ' || quote_ident(c_name);
			END IF;
		END $$
	`)

	// Update data
	DB.Exec(`UPDATE bookings SET cancelled_by = 'specialist' WHERE cancelled_by = 'trainer'`)
	DB.Exec(`UPDATE bookings SET created_by = 'specialist' WHERE created_by = 'trainer'`)
	DB.Exec(`UPDATE recurring_schedules SET created_by = 'specialist' WHERE created_by = 'trainer'`)

	// Add new constraints (ignore if already exist)
	DB.Exec(`ALTER TABLE bookings ADD CONSTRAINT bookings_cancelled_by_specialist_check
		CHECK(cancelled_by IN ('client','specialist') OR cancelled_by IS NULL)`)
	DB.Exec(`ALTER TABLE recurring_schedules ADD CONSTRAINT recurring_schedules_created_by_specialist_check
		CHECK(created_by IN ('client','specialist'))`)
}
