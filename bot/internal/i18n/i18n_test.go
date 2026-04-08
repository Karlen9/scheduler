package i18n

import (
	"context"
	"testing"
)

/***************************************************************************************************
* Implements the test init logic used by this module.
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
func TestInit(t *testing.T) {
	if err := Init(); err != nil {
		t.Fatalf("Init() returned error: %v", err)
	}
}

/***************************************************************************************************
* Implements the test new localizer logic used by this module.
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
func TestNewLocalizer(t *testing.T) {
	Init()

	t.Run("Russian", func(t *testing.T) {
		loc := NewLocalizer("ru")
		if loc == nil {
			t.Fatal("NewLocalizer(\"ru\") returned nil")
		}
	})

	t.Run("English", func(t *testing.T) {
		loc := NewLocalizer("en")
		if loc == nil {
			t.Fatal("NewLocalizer(\"en\") returned nil")
		}
	})
}

/***************************************************************************************************
* Implements the test t logic used by this module.
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
func TestT(t *testing.T) {
	Init()

	tests := []struct {
		name     string
		lang     string
		key      string
		expected string
	}{
		{
			name:     "Russian simple key",
			lang:     "ru",
			key:      "Btn.OpenApp",
			expected: "Запись",
		},
		{
			name:     "English simple key",
			lang:     "en",
			key:      "Btn.OpenApp",
			expected: "Book",
		},
		{
			name:     "Unknown key returns key itself",
			lang:     "ru",
			key:      "NonExistent.Key.12345",
			expected: "NonExistent.Key.12345",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			loc := NewLocalizer(tt.lang)
			got := T(loc, tt.key)
			if got != tt.expected {
				t.Errorf("T(%q) = %q, want %q", tt.key, got, tt.expected)
			}
		})
	}
}

/***************************************************************************************************
* Implements the test tf logic used by this module.
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
func TestTf(t *testing.T) {
	Init()

	tests := []struct {
		name     string
		lang     string
		key      string
		data     map[string]interface{}
		contains string
	}{
		{
			name: "Russian with template data",
			lang: "ru",
			key:  "Version",
			data: map[string]interface{}{
				"Version": "1.0.0",
			},
			contains: "1.0.0",
		},
		{
			name: "English with template data",
			lang: "en",
			key:  "Version",
			data: map[string]interface{}{
				"Version": "2.5.0",
			},
			contains: "2.5.0",
		},
		{
			name:     "Unknown key returns key itself",
			lang:     "ru",
			key:      "NonExistent.Template.Key",
			data:     map[string]interface{}{"Foo": "bar"},
			contains: "NonExistent.Template.Key",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			loc := NewLocalizer(tt.lang)
			got := Tf(loc, tt.key, tt.data)
			if got == "" {
				t.Errorf("Tf(%q) returned empty string", tt.key)
			}
			if tt.contains != "" && !containsStr(got, tt.contains) {
				t.Errorf("Tf(%q) = %q, want it to contain %q", tt.key, got, tt.contains)
			}
		})
	}
}

/***************************************************************************************************
* Implements the test default logic used by this module.
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
func TestDefault(t *testing.T) {
	Init()

	loc := Default()
	if loc == nil {
		t.Fatal("Default() returned nil")
	}

	/***************************************************************************************************
	* Default localizer should use Russian.
	***************************************************************************************************/
	got := T(loc, "Btn.OpenApp")
	if got != "Запись" {
		t.Errorf("Default localizer T(\"Btn.OpenApp\") = %q, want %q", got, "Запись")
	}
}

/***************************************************************************************************
* Implements the test with localizer and l logic used by this module.
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
func TestWithLocalizerAndL(t *testing.T) {
	Init()

	t.Run("stores and retrieves localizer from context", func(t *testing.T) {
		enLoc := NewLocalizer("en")
		ctx := WithLocalizer(context.Background(), enLoc)

		got := L(ctx)
		if got == nil {
			t.Fatal("L(ctx) returned nil")
		}

		/***************************************************************************************************
		* The retrieved localizer should produce English output.
		***************************************************************************************************/
		result := T(got, "Btn.OpenApp")
		if result != "Book" {
			t.Errorf("T with context localizer = %q, want %q", result, "Book")
		}
	})

	t.Run("falls back to default without localizer in context", func(t *testing.T) {
		ctx := context.Background()
		got := L(ctx)
		if got == nil {
			t.Fatal("L(ctx) returned nil for empty context")
		}

		/***************************************************************************************************
		* Fallback should be Russian (the default).
		***************************************************************************************************/
		result := T(got, "Btn.OpenApp")
		if result != "Запись" {
			t.Errorf("T with fallback localizer = %q, want %q", result, "Запись")
		}
	})
}

/***************************************************************************************************
* Implements the contains str logic used by this module.
*
* Parameters:
* - s: S used by the current operation.
* - substr: Substr used by the current operation.
*
* Returns:
* - The computed value for the current operation as bool.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
func containsStr(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsLoop(s, substr))
}

/***************************************************************************************************
* Implements the contains loop logic used by this module.
*
* Parameters:
* - s: S used by the current operation.
* - substr: Substr used by the current operation.
*
* Returns:
* - The computed value for the current operation as bool.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
func containsLoop(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
