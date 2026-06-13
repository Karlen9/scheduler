// Package payments provides a minimal ЮКасса (YooKassa) HTTP client.
package payments

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
)

const yookassaBaseURL = "https://api.yookassa.ru/v3"

// Client is a lightweight ЮКасса API client.
type Client struct {
	shopID     string
	secretKey  string
	httpClient *http.Client
}

// NewClient constructs a Client. Both shopID and secretKey must be non-empty when making real
// calls; the client itself accepts empty values so callers can construct it unconditionally and
// fail only at the point of use.
func NewClient(shopID, secretKey string) *Client {
	return &Client{
		shopID:    shopID,
		secretKey: secretKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Configured reports whether the client has non-empty credentials.
func (c *Client) Configured() bool {
	return c.shopID != "" && c.secretKey != ""
}

// CreatePaymentParams holds all inputs for CreatePayment.
type CreatePaymentParams struct {
	// AmountKopecks is the price in kopecks (e.g. 59000 = 590.00 RUB).
	AmountKopecks int
	// Description appears in the ЮКасса dashboard.
	Description string
	// Metadata is free-form key/value pairs stored with the payment.
	Metadata map[string]string
	// ReturnURL is the redirect destination after the user completes 3DS / card form.
	// Required for new purchases (PaymentMethodID == "").
	ReturnURL string
	// PaymentMethodID — if non-empty this is an autopay/renewal: no user interaction, no
	// confirmation object. If empty this is a new purchase: save_payment_method=true is set.
	PaymentMethodID string
	// IdempotenceKey, when non-empty, is sent as the Idempotence-Key header verbatim.
	// When empty a fresh random UUID is used (preserves existing checkout behavior).
	IdempotenceKey string
}

// PaymentResult is the parsed subset of a ЮКасса payment object we care about.
type PaymentResult struct {
	ID              string
	Status          string
	Paid            bool
	ConfirmationURL string
	// PaymentMethodID is populated on succeeded payments when ЮКасса returns a
	// payment_method.id (only present on save_payment_method=true responses).
	PaymentMethodID string
	// Metadata mirrors the free-form key/value map stored on the payment in ЮКасса.
	Metadata map[string]string
}

// yookassaPaymentRequest is the JSON body for POST /v3/payments.
type yookassaPaymentRequest struct {
	Amount struct {
		Value    string `json:"value"`
		Currency string `json:"currency"`
	} `json:"amount"`
	Capture           bool              `json:"capture"`
	Description       string            `json:"description"`
	Metadata          map[string]string `json:"metadata,omitempty"`
	Confirmation      *ykConfirmation   `json:"confirmation,omitempty"`
	SavePaymentMethod bool              `json:"save_payment_method,omitempty"`
	PaymentMethodID   string            `json:"payment_method_id,omitempty"`
}

type ykConfirmation struct {
	Type      string `json:"type"`
	ReturnURL string `json:"return_url"`
}

// yookassaPaymentResponse is the relevant subset of the ЮКасса payment JSON response.
type yookassaPaymentResponse struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	Paid   bool   `json:"paid"`
	Amount struct {
		Value    string `json:"value"`
		Currency string `json:"currency"`
	} `json:"amount"`
	Confirmation *struct {
		Type            string `json:"type"`
		ConfirmationURL string `json:"confirmation_url"`
	} `json:"confirmation"`
	PaymentMethod *struct {
		ID   string `json:"id"`
		Type string `json:"type"`
	} `json:"payment_method"`
	Metadata map[string]string `json:"metadata,omitempty"`
}

// formatKopecks converts an integer kopecks amount into the "NNN.NN" string ЮКасса expects.
// Examples: 59000 → "590.00", 14950 → "149.50".
func formatKopecks(kopecks int) string {
	return fmt.Sprintf("%d.%02d", kopecks/100, kopecks%100)
}

// CreatePayment sends POST /v3/payments and returns the parsed result.
//
// If params.PaymentMethodID is empty (new purchase):
//   - confirmation.return_url and save_payment_method=true are included.
//   - The response will contain a confirmation_url the user must visit.
//
// If params.PaymentMethodID is non-empty (autopay/renewal):
//   - payment_method_id is sent; confirmation and save_payment_method are omitted.
//   - No user interaction is required; status transitions to succeeded/canceled asynchronously.
func (c *Client) CreatePayment(ctx context.Context, params CreatePaymentParams) (*PaymentResult, error) {
	req := yookassaPaymentRequest{}
	req.Amount.Value = formatKopecks(params.AmountKopecks)
	req.Amount.Currency = "RUB"
	req.Capture = true
	req.Description = params.Description
	req.Metadata = params.Metadata

	if params.PaymentMethodID != "" {
		// Autopay / renewal — no confirmation step, no save.
		req.PaymentMethodID = params.PaymentMethodID
	} else {
		// New purchase — redirect flow, save payment method for future autopay.
		req.Confirmation = &ykConfirmation{
			Type:      "redirect",
			ReturnURL: params.ReturnURL,
		}
		req.SavePaymentMethod = true
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("yookassa: marshal request: %w", err)
	}

	idempotencyKey := params.IdempotenceKey
	if idempotencyKey == "" {
		idempotencyKey = uuid.New().String()
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, yookassaBaseURL+"/payments", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("yookassa: build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Idempotence-Key", idempotencyKey)
	httpReq.SetBasicAuth(c.shopID, c.secretKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("yookassa: http do: %w", err)
	}
	defer resp.Body.Close()

	return parsePaymentResponse(resp)
}

// GetPayment fetches a single payment by ID via GET /v3/payments/{id}.
// Used for webhook re-fetch verification (ЮКасса does not sign webhook payloads).
func (c *Client) GetPayment(ctx context.Context, id string) (*PaymentResult, error) {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, yookassaBaseURL+"/payments/"+id, nil)
	if err != nil {
		return nil, fmt.Errorf("yookassa: build get request: %w", err)
	}
	httpReq.SetBasicAuth(c.shopID, c.secretKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("yookassa: http do (get): %w", err)
	}
	defer resp.Body.Close()

	return parsePaymentResponse(resp)
}

// parsePaymentResponse reads an HTTP response and maps it to PaymentResult.
func parsePaymentResponse(resp *http.Response) (*PaymentResult, error) {
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("yookassa: read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("yookassa: non-2xx status %d: %s", resp.StatusCode, string(respBody))
	}

	var yk yookassaPaymentResponse
	if err := json.Unmarshal(respBody, &yk); err != nil {
		return nil, fmt.Errorf("yookassa: unmarshal response: %w", err)
	}

	result := &PaymentResult{
		ID:       yk.ID,
		Status:   yk.Status,
		Paid:     yk.Paid,
		Metadata: yk.Metadata,
	}
	if yk.Confirmation != nil {
		result.ConfirmationURL = yk.Confirmation.ConfirmationURL
	}
	if yk.PaymentMethod != nil {
		result.PaymentMethodID = yk.PaymentMethod.ID
	}

	return result, nil
}
