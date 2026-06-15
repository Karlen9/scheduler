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

// Receipt is the optional 54-ФЗ fiscal receipt attached to a payment.
type Receipt struct {
	CustomerEmail string
	CustomerPhone string
	TaxSystemCode int // omitted when 0
	Items         []ReceiptItem
}

// ReceiptItem is a single line on the fiscal receipt.
type ReceiptItem struct {
	Description    string
	AmountKopecks  int
	Quantity       string // e.g. "1.00"
	VATCode        int
	PaymentSubject string // e.g. "service"
	PaymentMode    string // e.g. "full_payment"
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
	// confirmation object. If empty this is a new purchase and SavePaymentMethod controls
	// whether save_payment_method is sent.
	PaymentMethodID string
	// SavePaymentMethod, when true, instructs ЮКасса to store the payment method for future
	// autopay/renewal. Only applies to new purchases (PaymentMethodID == ""). Requires the
	// YooKassa shop to have recurring/autopayments enabled; shops without it return HTTP 403.
	// Defaults to false (one-time payment).
	SavePaymentMethod bool
	// IdempotenceKey, when non-empty, is sent as the Idempotence-Key header verbatim.
	// When empty a fresh random UUID is used (preserves existing checkout behavior).
	IdempotenceKey string
	// Receipt is the optional 54-ФЗ fiscal receipt. When nil, no receipt is included
	// (preserves existing behavior for shops without fiscalization).
	Receipt *Receipt
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
	Receipt           *ykReceipt        `json:"receipt,omitempty"`
}

type ykConfirmation struct {
	Type      string `json:"type"`
	ReturnURL string `json:"return_url"`
}

type ykReceipt struct {
	Customer      ykReceiptCustomer `json:"customer"`
	Items         []ykReceiptItem   `json:"items"`
	TaxSystemCode int               `json:"tax_system_code,omitempty"`
}

type ykReceiptCustomer struct {
	Email string `json:"email,omitempty"`
	Phone string `json:"phone,omitempty"`
}

type ykReceiptItem struct {
	Description string `json:"description"`
	Quantity    string `json:"quantity"`
	Amount      struct {
		Value    string `json:"value"`
		Currency string `json:"currency"`
	} `json:"amount"`
	VATCode        int    `json:"vat_code"`
	PaymentSubject string `json:"payment_subject,omitempty"`
	PaymentMode    string `json:"payment_mode,omitempty"`
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
//   - confirmation.return_url is included.
//   - save_payment_method is set to params.SavePaymentMethod (caller-controlled).
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
		// New purchase — redirect flow; save payment method only if the caller opted in.
		req.Confirmation = &ykConfirmation{
			Type:      "redirect",
			ReturnURL: params.ReturnURL,
		}
		req.SavePaymentMethod = params.SavePaymentMethod
	}

	if params.Receipt != nil {
		r := params.Receipt
		ykr := &ykReceipt{
			Customer: ykReceiptCustomer{
				Email: r.CustomerEmail,
				Phone: r.CustomerPhone,
			},
			TaxSystemCode: r.TaxSystemCode,
		}
		ykr.Items = make([]ykReceiptItem, 0, len(r.Items))
		for _, item := range r.Items {
			qty := item.Quantity
			if qty == "" {
				qty = "1.00"
			}
			ri := ykReceiptItem{
				Description:    item.Description,
				Quantity:       qty,
				VATCode:        item.VATCode,
				PaymentSubject: item.PaymentSubject,
				PaymentMode:    item.PaymentMode,
			}
			ri.Amount.Value = formatKopecks(item.AmountKopecks)
			ri.Amount.Currency = "RUB"
			ykr.Items = append(ykr.Items, ri)
		}
		req.Receipt = ykr
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
