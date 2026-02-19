package crypto

import (
	"encoding/hex"
	"testing"
)

func validHexKey(t *testing.T) string {
	t.Helper()
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i)
	}
	return hex.EncodeToString(key)
}

func TestInit(t *testing.T) {
	tests := []struct {
		name    string
		key     string
		wantErr bool
		wantOn  bool
	}{
		{
			name:    "valid 32-byte hex key",
			key:     hex.EncodeToString(make([]byte, 32)),
			wantErr: false,
			wantOn:  true,
		},
		{
			name:    "too short key",
			key:     hex.EncodeToString(make([]byte, 16)),
			wantErr: true,
			wantOn:  false,
		},
		{
			name:    "invalid hex",
			key:     "not-hex",
			wantErr: true,
			wantOn:  false,
		},
		{
			name:    "empty key disables encryption",
			key:     "",
			wantErr: false,
			wantOn:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := Init(tt.key)
			if (err != nil) != tt.wantErr {
				t.Fatalf("Init() error = %v, wantErr %v", err, tt.wantErr)
			}
			if !tt.wantErr && Enabled() != tt.wantOn {
				t.Errorf("Enabled() = %v, want %v", Enabled(), tt.wantOn)
			}
		})
	}
}

func TestEncryptDecryptRoundTrip(t *testing.T) {
	if err := Init(validHexKey(t)); err != nil {
		t.Fatal(err)
	}

	originals := []string{
		"hello world",
		"",
		"bot123456:AAHdqTcv-something-long",
		"unicode: Привет мир 🔑",
	}

	for _, original := range originals {
		encrypted, err := Encrypt(original)
		if err != nil {
			t.Fatalf("Encrypt(%q) error: %v", original, err)
		}

		if original != "" && encrypted == original {
			t.Errorf("Encrypt(%q) returned plaintext unchanged", original)
		}

		if !IsEncrypted(encrypted) && original != "" {
			t.Errorf("Encrypt(%q) result missing enc: prefix", original)
		}

		decrypted, err := Decrypt(encrypted)
		if err != nil {
			t.Fatalf("Decrypt() error: %v", err)
		}
		if decrypted != original {
			t.Errorf("round-trip failed: got %q, want %q", decrypted, original)
		}
	}
}

func TestDecryptPlainText(t *testing.T) {
	if err := Init(validHexKey(t)); err != nil {
		t.Fatal(err)
	}

	plain := "some-plain-token"
	result, err := Decrypt(plain)
	if err != nil {
		t.Fatalf("Decrypt(plain) error: %v", err)
	}
	if result != plain {
		t.Errorf("Decrypt(plain) = %q, want %q", result, plain)
	}
}

func TestEncryptDisabledPassthrough(t *testing.T) {
	if err := Init(""); err != nil {
		t.Fatal(err)
	}

	plain := "my-token"
	encrypted, err := Encrypt(plain)
	if err != nil {
		t.Fatalf("Encrypt() error: %v", err)
	}
	if encrypted != plain {
		t.Errorf("disabled Encrypt() = %q, want passthrough %q", encrypted, plain)
	}
}

func TestHashToken(t *testing.T) {
	token := "bot123:AAHtest"

	h1 := HashToken(token)
	h2 := HashToken(token)

	if h1 == "" {
		t.Error("HashToken returned empty string")
	}
	if h1 != h2 {
		t.Error("HashToken is not deterministic")
	}
	if h1 == token {
		t.Error("HashToken returned the original token")
	}

	// Different input should produce different hash.
	h3 := HashToken("different-token")
	if h1 == h3 {
		t.Error("HashToken returned same hash for different inputs")
	}
}

func TestIsEncrypted(t *testing.T) {
	tests := []struct {
		value string
		want  bool
	}{
		{"enc:abc123", true},
		{"enc:", true},
		{"plaintext", false},
		{"", false},
		{"ENC:abc", false},
		{"encrypted:abc", false},
	}

	for _, tt := range tests {
		if got := IsEncrypted(tt.value); got != tt.want {
			t.Errorf("IsEncrypted(%q) = %v, want %v", tt.value, got, tt.want)
		}
	}
}

func TestEnabled(t *testing.T) {
	if err := Init(validHexKey(t)); err != nil {
		t.Fatal(err)
	}
	if !Enabled() {
		t.Error("Enabled() = false after Init with valid key")
	}

	if err := Init(""); err != nil {
		t.Fatal(err)
	}
	if Enabled() {
		t.Error("Enabled() = true after Init with empty key")
	}
}
