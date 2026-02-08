package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

const encPrefix = "enc:"

var (
	enabled bool
	gcm     cipher.AEAD
)

// Init initializes the encryption key from a hex-encoded string.
// If hexKey is empty, encryption is disabled (passthrough mode).
func Init(hexKey string) error {
	if hexKey == "" {
		enabled = false
		return nil
	}

	key, err := hex.DecodeString(hexKey)
	if err != nil {
		return fmt.Errorf("crypto: invalid hex key: %w", err)
	}
	if len(key) != 32 {
		return fmt.Errorf("crypto: key must be 32 bytes (got %d)", len(key))
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return fmt.Errorf("crypto: %w", err)
	}

	gcm, err = cipher.NewGCM(block)
	if err != nil {
		return fmt.Errorf("crypto: %w", err)
	}

	enabled = true
	return nil
}

// Enabled returns true if encryption is active.
func Enabled() bool {
	return enabled
}

// Encrypt encrypts plaintext using AES-256-GCM.
// Returns "enc:<base64(nonce+ciphertext)>" or plaintext if encryption is disabled.
func Encrypt(plaintext string) (string, error) {
	if !enabled {
		return plaintext, nil
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("crypto: failed to generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return encPrefix + base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decrypts a value. If it has the "enc:" prefix, it decrypts using AES-256-GCM.
// Plain text values (no prefix) are returned as-is.
func Decrypt(value string) (string, error) {
	if !IsEncrypted(value) {
		return value, nil
	}

	if !enabled {
		return "", errors.New("crypto: encrypted value found but no encryption key configured")
	}

	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(value, encPrefix))
	if err != nil {
		return "", fmt.Errorf("crypto: invalid base64: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(raw) < nonceSize {
		return "", errors.New("crypto: ciphertext too short")
	}

	nonce, ciphertext := raw[:nonceSize], raw[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("crypto: decryption failed: %w", err)
	}

	return string(plaintext), nil
}

// HashToken returns the SHA-256 hex hash of a token (for indexed DB lookups).
func HashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// IsEncrypted checks if a value has the "enc:" prefix.
func IsEncrypted(value string) bool {
	return strings.HasPrefix(value, encPrefix)
}
