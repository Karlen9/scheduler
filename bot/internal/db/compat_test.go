package db

import "testing"

func TestQ(t *testing.T) {
	t.Run("SQLite mode", func(t *testing.T) {
		origVal := isPostgres
		isPostgres = false
		defer func() { isPostgres = origVal }()

		tests := []struct {
			name  string
			input string
			want  string
		}{
			{"no placeholders", "SELECT * FROM users", "SELECT * FROM users"},
			{"single placeholder", "SELECT * FROM users WHERE id = ?", "SELECT * FROM users WHERE id = ?"},
			{"multiple placeholders", "INSERT INTO t (a, b, c) VALUES (?, ?, ?)", "INSERT INTO t (a, b, c) VALUES (?, ?, ?)"},
			{"empty string", "", ""},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				got := Q(tt.input)
				if got != tt.want {
					t.Errorf("Q(%q) = %q, want %q", tt.input, got, tt.want)
				}
			})
		}
	})

	t.Run("Postgres mode", func(t *testing.T) {
		origVal := isPostgres
		isPostgres = true
		defer func() { isPostgres = origVal }()

		tests := []struct {
			name  string
			input string
			want  string
		}{
			{"no placeholders", "SELECT * FROM users", "SELECT * FROM users"},
			{"single placeholder", "SELECT * FROM users WHERE id = ?", "SELECT * FROM users WHERE id = $1"},
			{"multiple placeholders", "INSERT INTO t (a, b, c) VALUES (?, ?, ?)", "INSERT INTO t (a, b, c) VALUES ($1, $2, $3)"},
			{"mixed with strings", "UPDATE t SET name = ? WHERE id = ? AND active = ?", "UPDATE t SET name = $1 WHERE id = $2 AND active = $3"},
			{"empty string", "", ""},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				got := Q(tt.input)
				if got != tt.want {
					t.Errorf("Q(%q) = %q, want %q", tt.input, got, tt.want)
				}
			})
		}
	})
}

func TestBoolVal(t *testing.T) {
	tests := []struct {
		name  string
		input bool
		want  int
	}{
		{"true returns 1", true, 1},
		{"false returns 0", false, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := BoolVal(tt.input)
			if got != tt.want {
				t.Errorf("BoolVal(%v) = %d, want %d", tt.input, got, tt.want)
			}
		})
	}
}

func TestDateNow(t *testing.T) {
	t.Run("SQLite mode", func(t *testing.T) {
		origVal := isPostgres
		isPostgres = false
		defer func() { isPostgres = origVal }()

		got := DateNow()
		if got != "date('now')" {
			t.Errorf("DateNow() = %q, want %q", got, "date('now')")
		}
	})

	t.Run("Postgres mode", func(t *testing.T) {
		origVal := isPostgres
		isPostgres = true
		defer func() { isPostgres = origVal }()

		got := DateNow()
		if got != "CURRENT_DATE" {
			t.Errorf("DateNow() = %q, want %q", got, "CURRENT_DATE")
		}
	})
}
