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
	gcm cipher.AEAD
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

	aead, err := newGCM(hexKey)
	if err != nil {
		return err
	}

	gcm = aead
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

	return seal(gcm, plaintext)
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

	return open(gcm, value)
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

/***************************************************************************************************
* Cipher is an independent AES-256-GCM instance bound to its own key. It uses the same "enc:" value
* format as the package-level functions and is used for key rotation, where two keys are needed at
* the same time.
***************************************************************************************************/
type Cipher struct {
	aead cipher.AEAD
}

/***************************************************************************************************
* NewCipher builds a Cipher from a hex-encoded 32-byte key. Unlike Init, an empty key is rejected.
*
* Parameters:
* - hexKey: Hex key used by the current operation.
*
* Returns:
* - The cipher together with an error when the key is empty or invalid.
*
* Side effects:
* - None.
***************************************************************************************************/
func NewCipher(hexKey string) (*Cipher, error) {
	if hexKey == "" {
		return nil, errors.New("crypto: key must not be empty")
	}
	aead, err := newGCM(hexKey)
	if err != nil {
		return nil, err
	}
	return &Cipher{aead: aead}, nil
}

/***************************************************************************************************
* Encrypt encrypts plaintext with this cipher's key. Returns "enc:<base64(nonce+ciphertext)>".
*
* Parameters:
* - plaintext: Plaintext used by the current operation.
*
* Returns:
* - The encrypted value together with an error when the operation cannot complete successfully.
*
* Side effects:
* - None.
***************************************************************************************************/
func (c *Cipher) Encrypt(plaintext string) (string, error) {
	return seal(c.aead, plaintext)
}

/***************************************************************************************************
* Decrypt decrypts an "enc:" value with this cipher's key. Values without the prefix are returned
* as-is.
*
* Parameters:
* - value: Input data consumed by the current operation.
*
* Returns:
* - The plaintext together with an error when the operation cannot complete successfully.
*
* Side effects:
* - None.
***************************************************************************************************/
func (c *Cipher) Decrypt(value string) (string, error) {
	if !IsEncrypted(value) {
		return value, nil
	}
	return open(c.aead, value)
}

/***************************************************************************************************
* newGCM validates a hex-encoded 32-byte key and builds an AES-256-GCM AEAD from it.
*
* Parameters:
* - hexKey: Hex key used by the current operation.
*
* Returns:
* - The AEAD together with an error when the key is invalid.
*
* Side effects:
* - None.
***************************************************************************************************/
func newGCM(hexKey string) (cipher.AEAD, error) {
	key, err := hex.DecodeString(hexKey)
	if err != nil {
		return nil, fmt.Errorf("crypto: invalid hex key: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("crypto: key must be 32 bytes (got %d)", len(key))
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("crypto: %w", err)
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("crypto: %w", err)
	}
	return aead, nil
}

/***************************************************************************************************
* seal encrypts plaintext with the given AEAD and returns the "enc:" formatted value.
*
* Parameters:
* - aead: AEAD used to encrypt.
* - plaintext: Plaintext used by the current operation.
*
* Returns:
* - The encrypted value together with an error when the nonce cannot be generated.
*
* Side effects:
* - Reads random bytes from the system source.
***************************************************************************************************/
func seal(aead cipher.AEAD, plaintext string) (string, error) {
	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("crypto: failed to generate nonce: %w", err)
	}

	ciphertext := aead.Seal(nonce, nonce, []byte(plaintext), nil)
	return encPrefix + base64.StdEncoding.EncodeToString(ciphertext), nil
}

/***************************************************************************************************
* open decrypts an "enc:" formatted value with the given AEAD.
*
* Parameters:
* - aead: AEAD used to decrypt.
* - value: Input data consumed by the current operation.
*
* Returns:
* - The plaintext together with an error when the value is malformed or authentication fails.
*
* Side effects:
* - None.
***************************************************************************************************/
func open(aead cipher.AEAD, value string) (string, error) {
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(value, encPrefix))
	if err != nil {
		return "", fmt.Errorf("crypto: invalid base64: %w", err)
	}

	nonceSize := aead.NonceSize()
	if len(raw) < nonceSize {
		return "", errors.New("crypto: ciphertext too short")
	}

	nonce, ciphertext := raw[:nonceSize], raw[nonceSize:]
	plaintext, err := aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("crypto: decryption failed: %w", err)
	}

	return string(plaintext), nil
}
