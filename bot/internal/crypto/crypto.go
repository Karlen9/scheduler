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

/***************************************************************************************************
* Defines the enc prefix value used by the current module.
*
* Usage context:
* - Reused by the current module to keep shared values centralized.
***************************************************************************************************/
const encPrefix = "enc:"

/***************************************************************************************************
* Groups related module-level variables declared together for this module.
***************************************************************************************************/
var (
	/***************************************************************************************************
	* Defines the enabled value used by the current module.
	*
	* Usage context:
	* - Reused by the current module to keep shared values centralized.
	***************************************************************************************************/
	enabled bool
	/***************************************************************************************************
	* Defines the gcm value used by the current module.
	*
	* Usage context:
	* - Reused by the current module to keep shared values centralized.
	***************************************************************************************************/
	gcm     cipher.AEAD
)

/***************************************************************************************************
* Init initializes the encryption key from a hex-encoded string. If hexKey is empty, encryption is
* disabled (passthrough mode).
*
* Parameters:
* - hexKey: Hex key used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
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

/***************************************************************************************************
* Enabled returns true if encryption is active.
*
* Parameters:
* - None.
*
* Returns:
* - The computed value for the current operation as bool.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
func Enabled() bool {
	return enabled
}

/***************************************************************************************************
* Encrypt encrypts plaintext using AES-256-GCM. Returns "enc:<base64(nonce+ciphertext)>" or
* plaintext if encryption is disabled.
*
* Parameters:
* - plaintext: Plaintext used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
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

/***************************************************************************************************
* Decrypt decrypts a value. If it has the "enc:" prefix, it decrypts using AES-256-GCM. Plain text
* values (no prefix) are returned as-is.
*
* Parameters:
* - value: Input data consumed by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
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

/***************************************************************************************************
* HashToken returns the SHA-256 hex hash of a token (for indexed DB lookups).
*
* Parameters:
* - token: Token used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
func HashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

/***************************************************************************************************
* IsEncrypted checks if a value has the "enc:" prefix.
*
* Parameters:
* - value: Input data consumed by the current operation.
*
* Returns:
* - The computed value for the current operation as bool.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
func IsEncrypted(value string) bool {
	return strings.HasPrefix(value, encPrefix)
}
