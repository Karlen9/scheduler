package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	_ "modernc.org/sqlite"

	"scheduler-bot/internal/crypto"
)

/***************************************************************************************************
* Defines the db value used by the database layer.
*
* Usage context:
* - Reused by the database layer to keep shared values centralized.
***************************************************************************************************/
var DB *sql.DB

/***************************************************************************************************
* Init initializes the database connection. If databaseURL starts with "postgres", it connects to
* PostgreSQL; otherwise it treats the value as a SQLite file path.
*
* Parameters:
* - databaseURL: Database url used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func Init(databaseURL string) error {
	if strings.HasPrefix(databaseURL, "postgres") {
		return initPostgres(databaseURL)
	}
	return initSQLite(databaseURL)
}

/***************************************************************************************************
* Implements the init sqlite logic used by this module.
*
* Parameters:
* - dbPath: Db path used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
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

/***************************************************************************************************
* Implements the init postgres logic used by this module.
*
* Parameters:
* - databaseURL: Database url used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func initPostgres(databaseURL string) error {
	isPostgres = true

	var err error
	DB, err = sql.Open("pgx", databaseURL)
	if err != nil {
		return err
	}

	DB.SetMaxOpenConns(50)
	DB.SetMaxIdleConns(25)
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

/***************************************************************************************************
* Implements the migrate sqlite logic used by this module.
*
* Parameters:
* - None.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func migrateSQLite() error {
	/***************************************************************************************************
	* Rename migrations for databases created before the universal naming refactor.
	***************************************************************************************************/
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
			type TEXT NOT NULL DEFAULT 'common' CHECK(type IN ('common','batch')),
			name TEXT NOT NULL,
			duration_minutes INTEGER NOT NULL,
			price INTEGER NOT NULL,
			currency TEXT DEFAULT 'RUB',
			sessions_count INTEGER,
			is_active BOOLEAN DEFAULT 1,
			CHECK(sessions_count IS NULL OR sessions_count > 1),
			CHECK(type != 'batch' OR sessions_count > 1)
		)`,
		`CREATE TABLE IF NOT EXISTS working_hours (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
			start_time TEXT NOT NULL,
			end_time TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_working_hours_specialist_day_start ON working_hours(specialist_id, day_of_week, start_time)`,
		`CREATE TABLE IF NOT EXISTS client_batches (
			id TEXT PRIMARY KEY,
			client_id TEXT NOT NULL REFERENCES clients(id),
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			service_id TEXT NOT NULL REFERENCES session_types(id),
			total_sessions INTEGER NOT NULL CHECK(total_sessions > 1),
			remaining_sessions INTEGER NOT NULL CHECK(remaining_sessions >= 0),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','exhausted'))
		)`,
		`CREATE INDEX IF NOT EXISTS idx_client_batches_client_service_status ON client_batches(client_id, service_id, status, created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_client_batches_specialist_client ON client_batches(specialist_id, client_id)`,
		`CREATE TABLE IF NOT EXISTS bookings (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			client_id TEXT NOT NULL REFERENCES clients(id),
			session_type_id TEXT NOT NULL REFERENCES session_types(id),
			client_batch_id TEXT REFERENCES client_batches(id),
			starts_at DATETIME NOT NULL,
			ends_at DATETIME NOT NULL,
			client_name TEXT NOT NULL,
			client_message TEXT,
			status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected','cancelled','completed','cancel_requested','reschedule_pending')),
			cancel_reason TEXT,
			cancelled_by TEXT CHECK(cancelled_by IN ('client','specialist') OR cancelled_by IS NULL),
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			reminder_sent BOOLEAN DEFAULT 0,
			duration_minutes INTEGER DEFAULT 60,
			created_by TEXT,
			recurring_schedule_id TEXT,
			telegram_notification_chat_id INTEGER,
			telegram_notification_msg_id INTEGER,
			client_notification_chat_id INTEGER,
			client_notification_msg_id INTEGER,
			replaces_booking_id TEXT
		)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_specialist_id ON bookings(specialist_id)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_specialist_starts_at ON bookings(specialist_id, starts_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_client_starts_at ON bookings(client_id, starts_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_starts_at ON bookings(starts_at)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_specialist_status_starts_at ON bookings(specialist_id, status, starts_at)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_client_status_starts_at ON bookings(client_id, status, starts_at)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_recurring_status_starts_at ON bookings(recurring_schedule_id, status, starts_at)`,
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
		`CREATE TABLE IF NOT EXISTS work_dates (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			date DATE NOT NULL,
			intervals TEXT DEFAULT '',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(specialist_id, date)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_work_dates_specialist_date ON work_dates(specialist_id, date)`,
		`CREATE TABLE IF NOT EXISTS rooms (
			id TEXT PRIMARY KEY,
			name TEXT DEFAULT '',
			created_by TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS room_members (
			id TEXT PRIMARY KEY,
			room_id TEXT NOT NULL,
			specialist_id TEXT,
			name TEXT NOT NULL,
			color TEXT NOT NULL,
			invite_code TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_room_members_specialist ON room_members(specialist_id) WHERE specialist_id IS NOT NULL`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_room_members_invite ON room_members(invite_code) WHERE invite_code IS NOT NULL`,
		`CREATE TABLE IF NOT EXISTS room_days (
			room_id TEXT NOT NULL,
			date DATE NOT NULL,
			member_id TEXT NOT NULL,
			PRIMARY KEY (room_id, date)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_room_days_member ON room_days(member_id)`,
		`CREATE TABLE IF NOT EXISTS room_day_requests (
			id TEXT PRIMARY KEY,
			room_id TEXT NOT NULL,
			date DATE NOT NULL,
			from_member_id TEXT NOT NULL,
			to_member_id TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			resolved_at DATETIME
		)`,
		`CREATE INDEX IF NOT EXISTS idx_room_day_requests_room_date ON room_day_requests(room_id, date)`,
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
		`CREATE INDEX IF NOT EXISTS idx_recurring_specialist_created_at ON recurring_schedules(specialist_id, created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_client_created_at ON recurring_schedules(client_id, created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_status_day_of_week_time ON recurring_schedules(status, day_of_week, "time")`,
		`CREATE INDEX IF NOT EXISTS idx_clients_specialist_name ON clients(specialist_id, name)`,
		`CREATE INDEX IF NOT EXISTS idx_session_types_specialist_active_type ON session_types(specialist_id, is_active, type)`,
		`CREATE TABLE IF NOT EXISTS support_threads (
			id TEXT PRIMARY KEY,
			telegram_user_id INTEGER UNIQUE NOT NULL,
			telegram_username TEXT DEFAULT '',
			display_name TEXT DEFAULT '',
			language_code TEXT DEFAULT '',
			topic_id INTEGER NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			last_message_at DATETIME,
			closed_at DATETIME
		)`,
		`CREATE INDEX IF NOT EXISTS idx_support_threads_topic_id ON support_threads(topic_id)`,
		`CREATE TABLE IF NOT EXISTS master_users (
			telegram_user_id INTEGER PRIMARY KEY,
			language TEXT NOT NULL DEFAULT 'ru',
			first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS dashboard_audit_log (
			id TEXT PRIMARY KEY,
			actor_telegram_id INTEGER NOT NULL,
			method TEXT NOT NULL,
			path TEXT NOT NULL,
			action TEXT NOT NULL,
			specialist_id TEXT,
			status_code INTEGER NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_dashboard_audit_created_at ON dashboard_audit_log(created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_dashboard_audit_specialist_id ON dashboard_audit_log(specialist_id)`,
	}

	for _, migration := range migrations {
		if _, err := DB.Exec(migration); err != nil {
			return err
		}
	}

	/***************************************************************************************************
	* ADD COLUMN migrations (ignore "duplicate column" errors).
	***************************************************************************************************/
	alterMigrations := []string{
		`ALTER TABLE specialists ADD COLUMN telegram_handle TEXT`,
		`ALTER TABLE specialists ADD COLUMN phone TEXT`,
		`ALTER TABLE specialists ADD COLUMN specialization TEXT`,
		`ALTER TABLE specialists ADD COLUMN bio TEXT`,
		`ALTER TABLE specialists ADD COLUMN photo_url TEXT`,
		`ALTER TABLE specialists ADD COLUMN photo_removed INTEGER DEFAULT 0`,
		`ALTER TABLE specialists ADD COLUMN bot_token_hash TEXT`,
		`ALTER TABLE specialists ADD COLUMN location_latitude REAL DEFAULT 0`,
		`ALTER TABLE specialists ADD COLUMN location_longitude REAL DEFAULT 0`,
		`ALTER TABLE specialists ADD COLUMN location_address TEXT`,
		`ALTER TABLE specialists ADD COLUMN available_durations TEXT`,
		`ALTER TABLE specialists ADD COLUMN notify_new_bookings INTEGER DEFAULT 1`,
		`ALTER TABLE specialists ADD COLUMN notify_cancellations INTEGER DEFAULT 1`,
		`ALTER TABLE specialists ADD COLUMN language TEXT DEFAULT 'ru'`,
		`ALTER TABLE specialists ADD COLUMN wallpaper TEXT DEFAULT ''`,
		`ALTER TABLE specialists ADD COLUMN referral_code TEXT`,
		`ALTER TABLE specialists ADD COLUMN referred_via_code TEXT`,
		`ALTER TABLE specialists ADD COLUMN deleted_at DATETIME`,
		`ALTER TABLE specialists ADD COLUMN consent_accepted_at DATETIME`,
		`ALTER TABLE specialists ADD COLUMN consent_version TEXT DEFAULT ''`,
		`ALTER TABLE specialists ADD COLUMN cancel_cutoff_enabled INTEGER DEFAULT 0`,
		`ALTER TABLE specialists ADD COLUMN schedule_mode TEXT DEFAULT 'weekly'`,
		`ALTER TABLE specialists ADD COLUMN default_intervals TEXT DEFAULT ''`,
		`ALTER TABLE specialists ADD COLUMN notify_work_days_reminder INTEGER DEFAULT 1`,
		`ALTER TABLE specialists ADD COLUMN work_days_reminder_week TEXT DEFAULT ''`,
		`ALTER TABLE clients ADD COLUMN phone TEXT`,
		`ALTER TABLE clients ADD COLUMN preferred_duration INTEGER DEFAULT 60`,
		`ALTER TABLE clients ADD COLUMN notify_booking_status INTEGER DEFAULT 1`,
		`ALTER TABLE clients ADD COLUMN notify_reminders INTEGER DEFAULT 1`,
		`ALTER TABLE clients ADD COLUMN notify_days_off INTEGER DEFAULT 0`,
		`ALTER TABLE clients ADD COLUMN notify_cancellations INTEGER DEFAULT 1`,
		`ALTER TABLE clients ADD COLUMN photo_url TEXT DEFAULT ''`,
		`ALTER TABLE clients ADD COLUMN photo_removed INTEGER DEFAULT 0`,
		`ALTER TABLE clients ADD COLUMN is_ghost INTEGER DEFAULT 0`,
		`ALTER TABLE clients ADD COLUMN language TEXT DEFAULT 'ru'`,
		`ALTER TABLE clients ADD COLUMN display_name TEXT DEFAULT ''`,
		`ALTER TABLE clients ADD COLUMN is_blocked INTEGER DEFAULT 0`,
		`ALTER TABLE clients ADD COLUMN referred_via_code TEXT`,
		`ALTER TABLE clients ADD COLUMN telegram_username TEXT DEFAULT ''`,
		`ALTER TABLE bookings ADD COLUMN reminder_sent BOOLEAN DEFAULT 0`,
		`ALTER TABLE bookings ADD COLUMN duration_minutes INTEGER DEFAULT 60`,
		`ALTER TABLE bookings ADD COLUMN created_by TEXT`,
		`ALTER TABLE bookings ADD COLUMN recurring_schedule_id TEXT`,
		`ALTER TABLE bookings ADD COLUMN replaces_booking_id TEXT`,
		`ALTER TABLE bookings ADD COLUMN telegram_notification_chat_id INTEGER`,
		`ALTER TABLE bookings ADD COLUMN telegram_notification_msg_id INTEGER`,
		`ALTER TABLE bookings ADD COLUMN client_notification_chat_id INTEGER`,
		`ALTER TABLE bookings ADD COLUMN client_notification_msg_id INTEGER`,
		`ALTER TABLE bookings ADD COLUMN client_batch_id TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN session_type_id TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN days_of_week TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN start_date TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN end_date TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN day_times TEXT`,
		`ALTER TABLE session_types ADD COLUMN image_url TEXT DEFAULT ''`,
		`ALTER TABLE session_types ADD COLUMN sessions_count INTEGER`,
	}

	for _, migration := range alterMigrations {
		DB.Exec(migration)
	}

	// Clients no longer support custom avatars — clear legacy custom uploads (bare Telegram
	// fileIDs) so they fall back to the client's Telegram profile photo. Telegram avatars are
	// stored with a "telegram:" prefix or as http URLs and are left intact.
	DB.Exec(`UPDATE clients SET photo_url = '' WHERE photo_url <> '' AND photo_url NOT LIKE 'telegram:%' AND photo_url NOT LIKE 'http%'`)
	DB.Exec(`UPDATE clients SET photo_removed = 0 WHERE photo_removed <> 0`)

	if err := migrateWorkingHoursMultiIntervalSQLite(); err != nil {
		return err
	}
	if err := migrateServiceTypesSQLite(); err != nil {
		return err
	}

	DB.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_specialists_bot_token_hash ON specialists(bot_token_hash)`)
	DB.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_specialists_referral_code ON specialists(referral_code) WHERE referral_code IS NOT NULL AND referral_code != ''`)

	migrateTrainerEnumSQLite()
	backfillSpecialistReferralCodes()

	return nil
}

/***************************************************************************************************
* Implements the migrate postgres logic used by this module.
*
* Parameters:
* - None.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func migratePostgres() error {
	/***************************************************************************************************
	* Rename migrations for databases created before the universal naming refactor.
	***************************************************************************************************/
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
			type TEXT NOT NULL DEFAULT 'common' CHECK(type IN ('common','batch')),
			name TEXT NOT NULL,
			duration_minutes INTEGER NOT NULL,
			price INTEGER NOT NULL,
			currency TEXT DEFAULT 'RUB',
			sessions_count INTEGER,
			is_active INTEGER DEFAULT 1,
			CHECK(sessions_count IS NULL OR sessions_count > 1),
			CHECK(type != 'batch' OR sessions_count > 1)
		)`,
		`CREATE TABLE IF NOT EXISTS working_hours (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
			start_time TEXT NOT NULL,
			end_time TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_working_hours_specialist_day_start ON working_hours(specialist_id, day_of_week, start_time)`,
		`CREATE TABLE IF NOT EXISTS client_batches (
			id TEXT PRIMARY KEY,
			client_id TEXT NOT NULL REFERENCES clients(id),
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			service_id TEXT NOT NULL REFERENCES session_types(id),
			total_sessions INTEGER NOT NULL CHECK(total_sessions > 1),
			remaining_sessions INTEGER NOT NULL CHECK(remaining_sessions >= 0),
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','exhausted'))
		)`,
		`CREATE INDEX IF NOT EXISTS idx_client_batches_client_service_status ON client_batches(client_id, service_id, status, created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_client_batches_specialist_client ON client_batches(specialist_id, client_id)`,
		`CREATE TABLE IF NOT EXISTS bookings (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			client_id TEXT NOT NULL REFERENCES clients(id),
			session_type_id TEXT NOT NULL REFERENCES session_types(id),
			client_batch_id TEXT REFERENCES client_batches(id),
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
		`CREATE INDEX IF NOT EXISTS idx_bookings_specialist_starts_at ON bookings(specialist_id, starts_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_client_starts_at ON bookings(client_id, starts_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_starts_at ON bookings(starts_at)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_specialist_status_starts_at ON bookings(specialist_id, status, starts_at)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_client_status_starts_at ON bookings(client_id, status, starts_at)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_recurring_status_starts_at ON bookings(recurring_schedule_id, status, starts_at)`,
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
		`CREATE TABLE IF NOT EXISTS work_dates (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			date DATE NOT NULL,
			intervals TEXT DEFAULT '',
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(specialist_id, date)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_work_dates_specialist_date ON work_dates(specialist_id, date)`,
		`CREATE TABLE IF NOT EXISTS rooms (
			id TEXT PRIMARY KEY,
			name TEXT DEFAULT '',
			created_by TEXT NOT NULL,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS room_members (
			id TEXT PRIMARY KEY,
			room_id TEXT NOT NULL,
			specialist_id TEXT,
			name TEXT NOT NULL,
			color TEXT NOT NULL,
			invite_code TEXT,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_room_members_specialist ON room_members(specialist_id) WHERE specialist_id IS NOT NULL`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_room_members_invite ON room_members(invite_code) WHERE invite_code IS NOT NULL`,
		`CREATE TABLE IF NOT EXISTS room_days (
			room_id TEXT NOT NULL,
			date DATE NOT NULL,
			member_id TEXT NOT NULL,
			PRIMARY KEY (room_id, date)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_room_days_member ON room_days(member_id)`,
		`CREATE TABLE IF NOT EXISTS room_day_requests (
			id TEXT PRIMARY KEY,
			room_id TEXT NOT NULL,
			date DATE NOT NULL,
			from_member_id TEXT NOT NULL,
			to_member_id TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			resolved_at TIMESTAMPTZ
		)`,
		`CREATE INDEX IF NOT EXISTS idx_room_day_requests_room_date ON room_day_requests(room_id, date)`,
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
		`CREATE INDEX IF NOT EXISTS idx_recurring_specialist_created_at ON recurring_schedules(specialist_id, created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_client_created_at ON recurring_schedules(client_id, created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_recurring_status_day_of_week_time ON recurring_schedules(status, day_of_week, "time")`,
		`CREATE INDEX IF NOT EXISTS idx_clients_specialist_name ON clients(specialist_id, name)`,
		`CREATE INDEX IF NOT EXISTS idx_session_types_specialist_active_type ON session_types(specialist_id, is_active, type)`,
		`CREATE TABLE IF NOT EXISTS support_threads (
			id TEXT PRIMARY KEY,
			telegram_user_id BIGINT UNIQUE NOT NULL,
			telegram_username TEXT DEFAULT '',
			display_name TEXT DEFAULT '',
			language_code TEXT DEFAULT '',
			topic_id INTEGER NOT NULL,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			last_message_at TIMESTAMPTZ,
			closed_at TIMESTAMPTZ
		)`,
		`CREATE INDEX IF NOT EXISTS idx_support_threads_topic_id ON support_threads(topic_id)`,
		`CREATE TABLE IF NOT EXISTS master_users (
			telegram_user_id BIGINT PRIMARY KEY,
			language TEXT NOT NULL DEFAULT 'ru',
			first_seen_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
			last_seen_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS dashboard_audit_log (
			id TEXT PRIMARY KEY,
			actor_telegram_id BIGINT NOT NULL,
			method TEXT NOT NULL,
			path TEXT NOT NULL,
			action TEXT NOT NULL,
			specialist_id TEXT,
			status_code INTEGER NOT NULL,
			created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_dashboard_audit_created_at ON dashboard_audit_log(created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_dashboard_audit_specialist_id ON dashboard_audit_log(specialist_id)`,
	}

	for _, migration := range migrations {
		if _, err := DB.Exec(migration); err != nil {
			return err
		}
	}

	/***************************************************************************************************
	* ADD COLUMN IF NOT EXISTS migrations.
	***************************************************************************************************/
	alterMigrations := []string{
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS telegram_handle TEXT`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS phone TEXT`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS specialization TEXT`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS bio TEXT`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS photo_url TEXT`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS photo_removed INTEGER DEFAULT 0`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS bot_token_hash TEXT`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS location_latitude DOUBLE PRECISION DEFAULT 0`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS location_longitude DOUBLE PRECISION DEFAULT 0`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS location_address TEXT`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS available_durations TEXT`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS notify_new_bookings INTEGER DEFAULT 1`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS notify_cancellations INTEGER DEFAULT 1`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ru'`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS wallpaper TEXT DEFAULT ''`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS referral_code TEXT`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS referred_via_code TEXT`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMP`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS consent_version TEXT DEFAULT ''`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS cancel_cutoff_enabled INTEGER DEFAULT 0`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS schedule_mode TEXT DEFAULT 'weekly'`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS default_intervals TEXT DEFAULT ''`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS notify_work_days_reminder INTEGER DEFAULT 1`,
		`ALTER TABLE specialists ADD COLUMN IF NOT EXISTS work_days_reminder_week TEXT DEFAULT ''`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone TEXT`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_duration INTEGER DEFAULT 60`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notify_booking_status INTEGER DEFAULT 1`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notify_reminders INTEGER DEFAULT 1`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notify_days_off INTEGER DEFAULT 0`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS notify_cancellations INTEGER DEFAULT 1`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT ''`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_removed INTEGER DEFAULT 0`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_ghost INTEGER DEFAULT 0`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'ru'`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS display_name TEXT DEFAULT ''`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_blocked INTEGER DEFAULT 0`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS referred_via_code TEXT`,
		`ALTER TABLE clients ADD COLUMN IF NOT EXISTS telegram_username TEXT DEFAULT ''`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_sent INTEGER DEFAULT 0`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 60`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by TEXT`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurring_schedule_id TEXT`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS replaces_booking_id TEXT`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS telegram_notification_chat_id BIGINT`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS telegram_notification_msg_id INTEGER`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_notification_chat_id BIGINT`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_notification_msg_id INTEGER`,
		`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS client_batch_id TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS session_type_id TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS days_of_week TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS start_date TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS end_date TEXT`,
		`ALTER TABLE recurring_schedules ADD COLUMN IF NOT EXISTS day_times TEXT`,
		`ALTER TABLE session_types ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT ''`,
		`ALTER TABLE session_types ADD COLUMN IF NOT EXISTS sessions_count INTEGER`,
	}

	for _, migration := range alterMigrations {
		if _, err := DB.Exec(migration); err != nil {
			return err
		}
	}

	// Clients no longer support custom avatars — clear legacy custom uploads (bare Telegram
	// fileIDs) so they fall back to the client's Telegram profile photo. Best-effort.
	if _, err := DB.Exec(`UPDATE clients SET photo_url = '' WHERE photo_url <> '' AND photo_url NOT LIKE 'telegram:%' AND photo_url NOT LIKE 'http%'`); err != nil {
		log.Printf("client custom-photo cleanup (postgres) failed: %v", err)
	}
	if _, err := DB.Exec(`UPDATE clients SET photo_removed = 0 WHERE photo_removed <> 0`); err != nil {
		log.Printf("client photo_removed reset (postgres) failed: %v", err)
	}

	if err := migrateWorkingHoursMultiIntervalPostgres(); err != nil {
		return err
	}
	if err := migrateServiceTypesPostgres(); err != nil {
		return err
	}

	DB.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_specialists_bot_token_hash ON specialists(bot_token_hash)`)
	DB.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_specialists_referral_code ON specialists(referral_code) WHERE referral_code IS NOT NULL AND referral_code != ''`)

	migrateTrainerEnumPostgres()
	backfillSpecialistReferralCodes()

	return nil
}

/***************************************************************************************************
* migrateWorkingHoursMultiIntervalSQLite rebuilds working_hours without the day-level UNIQUE
* constraint so multiple intervals can be stored for a single day.
*
* Parameters:
* - None.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func migrateWorkingHoursMultiIntervalSQLite() error {
	var createSQL sql.NullString
	err := DB.QueryRow(`
		SELECT sql
		FROM sqlite_master
		WHERE type = 'table' AND name = 'working_hours'
	`).Scan(&createSQL)
	if err == sql.ErrNoRows || !createSQL.Valid {
		return nil
	}
	if err != nil {
		return err
	}

	normalizedSQL := strings.ToUpper(strings.Join(strings.Fields(createSQL.String), ""))
	if !strings.Contains(normalizedSQL, "UNIQUE(SPECIALIST_ID,DAY_OF_WEEK)") {
		_, err := DB.Exec(`CREATE INDEX IF NOT EXISTS idx_working_hours_specialist_day_start ON working_hours(specialist_id, day_of_week, start_time)`)
		return err
	}

	if _, err := DB.Exec(`PRAGMA foreign_keys=off`); err != nil {
		return err
	}

	tx, err := DB.Begin()
	if err != nil {
		DB.Exec(`PRAGMA foreign_keys=on`)
		return err
	}

	stmts := []string{
		`CREATE TABLE working_hours_new (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
			start_time TEXT NOT NULL,
			end_time TEXT NOT NULL
		)`,
		`INSERT INTO working_hours_new (id, specialist_id, day_of_week, start_time, end_time)
		SELECT id, specialist_id, day_of_week, start_time, end_time
		FROM working_hours`,
		`DROP TABLE working_hours`,
		`ALTER TABLE working_hours_new RENAME TO working_hours`,
		`CREATE INDEX IF NOT EXISTS idx_working_hours_specialist_day_start ON working_hours(specialist_id, day_of_week, start_time)`,
	}

	for _, stmt := range stmts {
		if _, err := tx.Exec(stmt); err != nil {
			tx.Rollback()
			DB.Exec(`PRAGMA foreign_keys=on`)
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		DB.Exec(`PRAGMA foreign_keys=on`)
		return err
	}

	_, err = DB.Exec(`PRAGMA foreign_keys=on`)
	return err
}

/***************************************************************************************************
* migrateWorkingHoursMultiIntervalPostgres drops the day-level UNIQUE constraint from working_hours
* and replaces it with a non-unique lookup index.
*
* Parameters:
* - None.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func migrateWorkingHoursMultiIntervalPostgres() error {
	if _, err := DB.Exec(`
		DO $$
		DECLARE c_name TEXT;
		BEGIN
			SELECT conname INTO c_name
			FROM pg_constraint
			WHERE conrelid = 'working_hours'::regclass
				AND contype = 'u'
				AND replace(pg_get_constraintdef(oid), ' ', '') = 'UNIQUE(specialist_id,day_of_week)';
			IF c_name IS NOT NULL THEN
				EXECUTE 'ALTER TABLE working_hours DROP CONSTRAINT ' || quote_ident(c_name);
			END IF;
		END $$
	`); err != nil {
		return err
	}

	_, err := DB.Exec(`CREATE INDEX IF NOT EXISTS idx_working_hours_specialist_day_start ON working_hours(specialist_id, day_of_week, start_time)`)
	return err
}

func sqliteColumnExists(tableName, columnName string) bool {
	rows, err := DB.Query(`PRAGMA table_info(` + tableName + `)`)
	if err != nil {
		return false
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name, columnType string
		var notNull int
		var defaultValue interface{}
		var pk int
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &pk); err != nil {
			return false
		}
		if name == columnName {
			return true
		}
	}
	return false
}

/***************************************************************************************************
* migrateServiceTypesSQLite rebuilds session_types when needed so the type column is constrained to
* common/batch and batch services can store sessions_count.
***************************************************************************************************/
func migrateServiceTypesSQLite() error {
	var createSQL sql.NullString
	err := DB.QueryRow(`
		SELECT sql
		FROM sqlite_master
		WHERE type = 'table' AND name = 'session_types'
	`).Scan(&createSQL)
	if err == sql.ErrNoRows || !createSQL.Valid {
		return nil
	}
	if err != nil {
		return err
	}

	if strings.Contains(createSQL.String, "'common'") &&
		strings.Contains(createSQL.String, "'batch'") &&
		strings.Contains(createSQL.String, "sessions_count") &&
		strings.Contains(createSQL.String, "type != 'batch'") {
		return nil
	}

	sessionsExpr := "NULL"
	if sqliteColumnExists("session_types", "sessions_count") {
		sessionsExpr = "CASE WHEN type = 'batch' AND sessions_count > 1 THEN sessions_count ELSE NULL END"
	}

	if _, err := DB.Exec(`PRAGMA foreign_keys=off`); err != nil {
		return err
	}

	tx, err := DB.Begin()
	if err != nil {
		DB.Exec(`PRAGMA foreign_keys=on`)
		return err
	}

	stmts := []string{
		`CREATE TABLE session_types_new (
			id TEXT PRIMARY KEY,
			specialist_id TEXT NOT NULL REFERENCES specialists(id),
			type TEXT NOT NULL DEFAULT 'common' CHECK(type IN ('common','batch')),
			name TEXT NOT NULL,
			duration_minutes INTEGER NOT NULL,
			price INTEGER NOT NULL,
			currency TEXT DEFAULT 'RUB',
			image_url TEXT DEFAULT '',
			sessions_count INTEGER,
			is_active BOOLEAN DEFAULT 1,
			CHECK(sessions_count IS NULL OR sessions_count > 1),
			CHECK(type != 'batch' OR sessions_count > 1)
		)`,
		fmt.Sprintf(`INSERT INTO session_types_new (id, specialist_id, type, name, duration_minutes, price, currency, image_url, sessions_count, is_active)
		SELECT id, specialist_id,
			CASE WHEN type = 'batch' THEN 'batch' ELSE 'common' END,
			name, duration_minutes, price, currency, COALESCE(image_url, ''), %s, is_active
		FROM session_types`, sessionsExpr),
		`DROP TABLE session_types`,
		`ALTER TABLE session_types_new RENAME TO session_types`,
		`CREATE INDEX IF NOT EXISTS idx_session_types_specialist_active_type ON session_types(specialist_id, is_active, type)`,
	}

	for _, stmt := range stmts {
		if _, err := tx.Exec(stmt); err != nil {
			tx.Rollback()
			DB.Exec(`PRAGMA foreign_keys=on`)
			return err
		}
	}

	if err := tx.Commit(); err != nil {
		DB.Exec(`PRAGMA foreign_keys=on`)
		return err
	}

	_, err = DB.Exec(`PRAGMA foreign_keys=on`)
	return err
}

/***************************************************************************************************
* migrateServiceTypesPostgres normalizes existing service type values and adds CHECK constraints for
* common/batch services plus optional sessions_count.
***************************************************************************************************/
func migrateServiceTypesPostgres() error {
	stmts := []string{
		`UPDATE session_types SET type = 'common' WHERE type IS NULL OR type NOT IN ('common','batch')`,
		`UPDATE session_types SET sessions_count = NULL WHERE type = 'common'`,
		`UPDATE session_types SET sessions_count = 2 WHERE type = 'batch' AND (sessions_count IS NULL OR sessions_count <= 1)`,
		`ALTER TABLE session_types ALTER COLUMN type SET DEFAULT 'common'`,
		`ALTER TABLE session_types ALTER COLUMN type SET NOT NULL`,
		`DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1 FROM pg_constraint
				WHERE conrelid = 'session_types'::regclass
				  AND conname = 'session_types_type_common_batch_check'
			) THEN
				ALTER TABLE session_types ADD CONSTRAINT session_types_type_common_batch_check
					CHECK(type IN ('common','batch'));
			END IF;
			IF NOT EXISTS (
				SELECT 1 FROM pg_constraint
				WHERE conrelid = 'session_types'::regclass
				  AND conname = 'session_types_sessions_count_min_check'
			) THEN
				ALTER TABLE session_types ADD CONSTRAINT session_types_sessions_count_min_check
					CHECK(sessions_count IS NULL OR sessions_count > 1);
			END IF;
			IF NOT EXISTS (
				SELECT 1 FROM pg_constraint
				WHERE conrelid = 'session_types'::regclass
				  AND conname = 'session_types_batch_sessions_count_check'
			) THEN
				ALTER TABLE session_types ADD CONSTRAINT session_types_batch_sessions_count_check
					CHECK(type != 'batch' OR sessions_count > 1);
			END IF;
		END $$`,
	}
	for _, stmt := range stmts {
		if _, err := DB.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

/***************************************************************************************************
* Implements the close logic used by this module.
*
* Parameters:
* - None.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func Close() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}

/***************************************************************************************************
* MigrateEncryptTokens encrypts any plain-text bot tokens and populates bot_token_hash.
* Idempotent: skips rows that are already encrypted with a correct hash.
*
* Parameters:
* - None.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
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

/***************************************************************************************************
* migrateTrainerEnumSQLite rebuilds bookings and recurring_schedules tables to update CHECK
* constraints and data from 'trainer' to 'specialist'.
*
* Parameters:
* - None.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func migrateTrainerEnumSQLite() {
	var bookingsSQL string
	if err := DB.QueryRow(`SELECT sql FROM sqlite_master WHERE type='table' AND name='bookings'`).Scan(&bookingsSQL); err != nil {
		return
	}
	if !strings.Contains(bookingsSQL, "'trainer'") {
		return // Already migrated or fresh install
	}

	log.Println("Migrating 'trainer' enum values to 'specialist' in SQLite...")

	/***************************************************************************************************
	* PRAGMA foreign_keys cannot be changed inside a transaction.
	***************************************************************************************************/
	DB.Exec(`PRAGMA foreign_keys=off`)

	tx, err := DB.Begin()
	if err != nil {
		log.Printf("Migration error (begin tx): %v", err)
		DB.Exec(`PRAGMA foreign_keys=on`)
		return
	}

	stmts := []string{
		/***************************************************************************************************
		* Rebuild bookings table.
		***************************************************************************************************/
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
			telegram_notification_msg_id INTEGER,
			client_notification_chat_id INTEGER,
			client_notification_msg_id INTEGER,
			client_batch_id TEXT
		)`,
		`INSERT INTO bookings_new (id, specialist_id, client_id, session_type_id, starts_at, ends_at,
			client_name, client_message, status, cancel_reason, cancelled_by, created_at,
			replaces_booking_id, reminder_sent, duration_minutes, created_by, recurring_schedule_id,
			telegram_notification_chat_id, telegram_notification_msg_id, client_notification_chat_id,
			client_notification_msg_id, client_batch_id)
		SELECT id, specialist_id, client_id, session_type_id, starts_at, ends_at,
			client_name, client_message, status, cancel_reason,
			CASE cancelled_by WHEN 'trainer' THEN 'specialist' ELSE cancelled_by END,
			created_at, replaces_booking_id, reminder_sent, duration_minutes,
			CASE created_by WHEN 'trainer' THEN 'specialist' ELSE created_by END,
			recurring_schedule_id, telegram_notification_chat_id, telegram_notification_msg_id,
			client_notification_chat_id, client_notification_msg_id, client_batch_id
		FROM bookings`,
		`DROP TABLE bookings`,
		`ALTER TABLE bookings_new RENAME TO bookings`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_specialist_id ON bookings(specialist_id)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_starts_at ON bookings(starts_at)`,
		`CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`,

		/***************************************************************************************************
		* Rebuild recurring_schedules table.
		***************************************************************************************************/
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

/***************************************************************************************************
* migrateTrainerEnumPostgres updates CHECK constraints and data from 'trainer' to 'specialist'.
*
* Parameters:
* - None.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func migrateTrainerEnumPostgres() {
	/***************************************************************************************************
	* Dynamically find and drop old CHECK constraints that reference 'trainer'.
	***************************************************************************************************/
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

	/***************************************************************************************************
	* Update data.
	***************************************************************************************************/
	DB.Exec(`UPDATE bookings SET cancelled_by = 'specialist' WHERE cancelled_by = 'trainer'`)
	DB.Exec(`UPDATE bookings SET created_by = 'specialist' WHERE created_by = 'trainer'`)
	DB.Exec(`UPDATE recurring_schedules SET created_by = 'specialist' WHERE created_by = 'trainer'`)

	/***************************************************************************************************
	* Add new constraints (ignore if already exist).
	***************************************************************************************************/
	DB.Exec(`ALTER TABLE bookings ADD CONSTRAINT bookings_cancelled_by_specialist_check
		CHECK(cancelled_by IN ('client','specialist') OR cancelled_by IS NULL)`)
	DB.Exec(`ALTER TABLE recurring_schedules ADD CONSTRAINT recurring_schedules_created_by_specialist_check
		CHECK(created_by IN ('client','specialist'))`)
}

/***************************************************************************************************
* backfillSpecialistReferralCodes assigns a random referral_code to any specialist that does not
* already have one. Runs after migrations; retries once per specialist on collision.
***************************************************************************************************/
func backfillSpecialistReferralCodes() {
	rows, err := DB.Query(Q(`SELECT id FROM specialists WHERE referral_code IS NULL OR referral_code = ''`))
	if err != nil {
		log.Printf("backfill referral codes: query failed: %v", err)
		return
	}
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			log.Printf("backfill referral codes: scan failed: %v", err)
			return
		}
		ids = append(ids, id)
	}
	rows.Close()

	for _, id := range ids {
		for attempt := 0; attempt < 3; attempt++ {
			code := generateReferralCode()
			if _, err := DB.Exec(Q(`UPDATE specialists SET referral_code = ? WHERE id = ? AND (referral_code IS NULL OR referral_code = '')`), code, id); err == nil {
				break
			}
		}
	}
}
