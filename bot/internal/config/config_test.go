package config

import (
	"testing"
)

/***************************************************************************************************
* Implements the test parse admin ids logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
func TestParseAdminIDs(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []int64
	}{
		{
			name:     "empty string",
			input:    "",
			expected: nil,
		},
		{
			name:     "single ID",
			input:    "12345",
			expected: []int64{12345},
		},
		{
			name:     "multiple IDs",
			input:    "111,222,333",
			expected: []int64{111, 222, 333},
		},
		{
			name:     "with brackets",
			input:    "[111,222,333]",
			expected: []int64{111, 222, 333},
		},
		{
			name:     "with spaces",
			input:    " 111 , 222 , 333 ",
			expected: []int64{111, 222, 333},
		},
		{
			name:     "invalid entries skipped",
			input:    "111,abc,333",
			expected: []int64{111, 333},
		},
		{
			name:     "all invalid",
			input:    "abc,def",
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseAdminIDs(tt.input)
			if len(result) != len(tt.expected) {
				t.Fatalf("got %d IDs, want %d", len(result), len(tt.expected))
			}
			for i := range result {
				if result[i] != tt.expected[i] {
					t.Errorf("index %d: got %d, want %d", i, result[i], tt.expected[i])
				}
			}
		})
	}
}

/***************************************************************************************************
* Implements the test load defaults logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
func TestLoadDefaults(t *testing.T) {
	/***************************************************************************************************
	* PUBLIC_BASE_URL is required (log.Fatal if empty), always set it.
	***************************************************************************************************/
	t.Setenv("PUBLIC_BASE_URL", "https://example.com")

	/***************************************************************************************************
	* Clear vars that have defaults so we test the defaults.
	***************************************************************************************************/
	t.Setenv("PORT", "")
	t.Setenv("DATABASE_PATH", "")
	t.Setenv("SPECIALIST_NAME", "")
	t.Setenv("WEB_APP_URL", "")

	cfg := Load()

	if cfg.Port != "8080" {
		t.Errorf("Port = %q, want %q", cfg.Port, "8080")
	}
	if cfg.DatabasePath != "./data/scheduler.db" {
		t.Errorf("DatabasePath = %q, want %q", cfg.DatabasePath, "./data/scheduler.db")
	}
	if cfg.SpecialistName != "Specialist" {
		t.Errorf("SpecialistName = %q, want %q", cfg.SpecialistName, "Specialist")
	}
	if cfg.WebAppURL != "https://your-mini-app-url.com" {
		t.Errorf("WebAppURL = %q, want %q", cfg.WebAppURL, "https://your-mini-app-url.com")
	}
	if cfg.PublicBaseURL != "https://example.com" {
		t.Errorf("PublicBaseURL = %q, want %q", cfg.PublicBaseURL, "https://example.com")
	}
}

/***************************************************************************************************
* Implements the test load with env vars logic used by this module.
*
* Parameters:
* - t: T used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
func TestLoadWithEnvVars(t *testing.T) {
	t.Setenv("PUBLIC_BASE_URL", "https://my-app.com")
	t.Setenv("PORT", "9090")
	t.Setenv("DATABASE_PATH", "/tmp/test.db")
	t.Setenv("SPECIALIST_NAME", "John")
	t.Setenv("WEB_APP_URL", "https://webapp.example.com")
	t.Setenv("ADMIN_IDS", "[100,200]")
	t.Setenv("SPECIALIST_TELEGRAM_ID", "55555")

	cfg := Load()

	if cfg.Port != "9090" {
		t.Errorf("Port = %q, want %q", cfg.Port, "9090")
	}
	if cfg.DatabasePath != "/tmp/test.db" {
		t.Errorf("DatabasePath = %q, want %q", cfg.DatabasePath, "/tmp/test.db")
	}
	if cfg.SpecialistName != "John" {
		t.Errorf("SpecialistName = %q, want %q", cfg.SpecialistName, "John")
	}
	if cfg.WebAppURL != "https://webapp.example.com" {
		t.Errorf("WebAppURL = %q, want %q", cfg.WebAppURL, "https://webapp.example.com")
	}
	if cfg.SpecialistTelegramID != 55555 {
		t.Errorf("SpecialistTelegramID = %d, want %d", cfg.SpecialistTelegramID, 55555)
	}
	if len(cfg.AdminIDs) != 2 || cfg.AdminIDs[0] != 100 || cfg.AdminIDs[1] != 200 {
		t.Errorf("AdminIDs = %v, want [100 200]", cfg.AdminIDs)
	}
}
