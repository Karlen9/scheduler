package db

import "database/sql"

const settingRecurringPaymentsEnabled = "recurring_payments_enabled"

// GetRecurringPaymentsEnabled reads the global flag that controls whether
// save_payment_method=true is sent to ЮКасса on new subscription checkouts.
// Returns false (disabled) by default when the key has never been set.
func GetRecurringPaymentsEnabled() (bool, error) {
	var value string
	err := DB.QueryRow(Q(`SELECT value FROM app_meta WHERE key = ?`), settingRecurringPaymentsEnabled).Scan(&value)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return value == "1", nil
}

// SetRecurringPaymentsEnabled persists the global recurring-payments flag.
// Passing true stores "1"; false stores "0".
func SetRecurringPaymentsEnabled(enabled bool) error {
	value := "0"
	if enabled {
		value = "1"
	}
	_, err := DB.Exec(
		Q(`INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?`),
		settingRecurringPaymentsEnabled, value, value,
	)
	return err
}
