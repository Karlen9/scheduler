package telegram

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

const telegramAPI = "https://api.telegram.org/bot"

// Bot represents a Telegram bot
type Bot struct {
	Token    string
	Username string
}

// WebAppInfo holds web app URL
type WebAppInfo struct {
	URL string `json:"url"`
}

// InlineKeyboardButton represents an inline keyboard button
type InlineKeyboardButton struct {
	Text         string      `json:"text"`
	WebApp       *WebAppInfo `json:"web_app,omitempty"`
	CallbackData string      `json:"callback_data,omitempty"`
}

// InlineKeyboardMarkup represents an inline keyboard
type InlineKeyboardMarkup struct {
	InlineKeyboard [][]InlineKeyboardButton `json:"inline_keyboard"`
}

// SendMessageRequest is the request body for sendMessage
type SendMessageRequest struct {
	ChatID      int64                 `json:"chat_id"`
	Text        string                `json:"text"`
	ParseMode   string                `json:"parse_mode,omitempty"`
	ReplyMarkup *InlineKeyboardMarkup `json:"reply_markup,omitempty"`
}

// EditMessageTextRequest is the request body for editMessageText
type EditMessageTextRequest struct {
	ChatID      int64                 `json:"chat_id"`
	MessageID   int                   `json:"message_id"`
	Text        string                `json:"text"`
	ParseMode   string                `json:"parse_mode,omitempty"`
	ReplyMarkup *InlineKeyboardMarkup `json:"reply_markup,omitempty"`
}

// Update represents a Telegram update
type Update struct {
	UpdateID      int            `json:"update_id"`
	Message       *Message       `json:"message,omitempty"`
	CallbackQuery *CallbackQuery `json:"callback_query,omitempty"`
}

// Message represents a Telegram message
type Message struct {
	MessageID int    `json:"message_id"`
	Chat      Chat   `json:"chat"`
	From      *User  `json:"from,omitempty"`
	Text      string `json:"text,omitempty"`
}

// Chat represents a Telegram chat
type Chat struct {
	ID int64 `json:"id"`
}

// User represents a Telegram user
type User struct {
	ID        int64  `json:"id"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name,omitempty"`
	Username  string `json:"username,omitempty"`
}

// CallbackQuery represents a callback query
type CallbackQuery struct {
	ID      string   `json:"id"`
	From    User     `json:"from"`
	Message *Message `json:"message,omitempty"`
	Data    string   `json:"data"`
}

// GetUpdatesResponse is the response from getUpdates
type GetUpdatesResponse struct {
	OK     bool     `json:"ok"`
	Result []Update `json:"result"`
}

// GetMeResponse is the response from getMe
type GetMeResponse struct {
	OK     bool `json:"ok"`
	Result struct {
		Username string `json:"username"`
	} `json:"result"`
}

// SetWebhookRequest is the request body for setWebhook
type SetWebhookRequest struct {
	URL         string `json:"url"`
	SecretToken string `json:"secret_token,omitempty"`
}

// SetWebhookResponse is the response from setWebhook
type SetWebhookResponse struct {
	OK          bool   `json:"ok"`
	Result      bool   `json:"result"`
	Description string `json:"description,omitempty"`
}

// SendMessageResponse is the response from sendMessage
type SendMessageResponse struct {
	OK     bool    `json:"ok"`
	Result Message `json:"result"`
}

// NewBot creates a new Bot instance
func NewBot(token string) (*Bot, error) {
	bot := &Bot{Token: token}

	resp, err := http.Get(telegramAPI + token + "/getMe")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result GetMeResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if !result.OK {
		return nil, fmt.Errorf("getMe returned not OK")
	}

	bot.Username = result.Result.Username
	return bot, nil
}

// GetUpdates fetches updates from Telegram
func (b *Bot) GetUpdates(offset int) ([]Update, error) {
	resp, err := http.Get(fmt.Sprintf("%s%s/getUpdates?offset=%d&timeout=60", telegramAPI, b.Token, offset))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result GetUpdatesResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if !result.OK {
		return nil, fmt.Errorf("getUpdates returned not OK")
	}

	return result.Result, nil
}

// DeleteWebhook removes the current webhook and optionally drops pending updates
func (b *Bot) DeleteWebhook(dropPending bool) error {
	data := map[string]interface{}{
		"drop_pending_updates": dropPending,
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	resp, err := http.Post(
		telegramAPI+b.Token+"/deleteWebhook",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var result SetWebhookResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return err
	}

	if !result.OK {
		return fmt.Errorf("deleteWebhook returned not OK: %s", result.Description)
	}
	return nil
}

// SetWebhook sets the webhook URL for the bot
func (b *Bot) SetWebhook(url string, secretToken string) error {
	req := SetWebhookRequest{
		URL:         url,
		SecretToken: secretToken,
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		return err
	}

	resp, err := http.Post(
		telegramAPI+b.Token+"/setWebhook",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var result SetWebhookResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return err
	}

	if !result.OK {
		if result.Description != "" {
			return fmt.Errorf("setWebhook returned not OK: %s", result.Description)
		}
		return fmt.Errorf("setWebhook returned not OK")
	}

	if !result.Result {
		return fmt.Errorf("setWebhook returned false")
	}

	return nil
}

// GetWebhookInfo returns current webhook info for debugging
func (b *Bot) GetWebhookInfo() (string, int, string) {
	resp, err := http.Get(telegramAPI + b.Token + "/getWebhookInfo")
	if err != nil {
		return "", 0, err.Error()
	}
	defer resp.Body.Close()

	var result struct {
		OK     bool `json:"ok"`
		Result struct {
			URL                  string `json:"url"`
			PendingUpdateCount   int    `json:"pending_update_count"`
			LastErrorMessage     string `json:"last_error_message"`
			LastErrorDate        int    `json:"last_error_date"`
		} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", 0, err.Error()
	}
	return result.Result.URL, result.Result.PendingUpdateCount, result.Result.LastErrorMessage
}

// SendMessage sends a message
func (b *Bot) SendMessage(chatID int64, text string, replyMarkup *InlineKeyboardMarkup) (*Message, error) {
	req := SendMessageRequest{
		ChatID:      chatID,
		Text:        text,
		ReplyMarkup: replyMarkup,
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}

	resp, err := http.Post(
		telegramAPI+b.Token+"/sendMessage",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result SendMessageResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if !result.OK {
		return nil, fmt.Errorf("sendMessage returned not OK")
	}

	return &result.Result, nil
}

// EditMessageText edits a message's text
func (b *Bot) EditMessageText(chatID int64, messageID int, text string, replyMarkup *InlineKeyboardMarkup) error {
	req := EditMessageTextRequest{
		ChatID:      chatID,
		MessageID:   messageID,
		Text:        text,
		ReplyMarkup: replyMarkup,
	}

	jsonData, err := json.Marshal(req)
	if err != nil {
		return err
	}

	resp, err := http.Post(
		telegramAPI+b.Token+"/editMessageText",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("editMessageText returned status: %d", resp.StatusCode)
	}

	return nil
}

// AnswerCallbackQuery answers a callback query
func (b *Bot) AnswerCallbackQuery(callbackQueryID string, text string) error {
	data := map[string]interface{}{
		"callback_query_id": callbackQueryID,
	}
	if text != "" {
		data["text"] = text
	}

	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	resp, err := http.Post(
		telegramAPI+b.Token+"/answerCallbackQuery",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// SendBookingApprovalMessage sends a booking approval request to trainer
func (b *Bot) SendBookingApprovalMessage(trainerChatID int64, bookingID string, text string) (*Message, error) {
	keyboard := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: BtnAccept, CallbackData: fmt.Sprintf("accept:%s", bookingID)},
				{Text: BtnReject, CallbackData: fmt.Sprintf("reject:%s", bookingID)},
			},
		},
	}

	return b.SendMessage(trainerChatID, text, keyboard)
}

// SendWebAppButton sends a message with web app button
func (b *Bot) SendWebAppButton(chatID int64, text, webAppURL string) (*Message, error) {
	keyboard := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: BtnOpenApp, WebApp: &WebAppInfo{URL: webAppURL}},
			},
		},
	}

	return b.SendMessage(chatID, text, keyboard)
}

// PollUpdates starts polling for updates
func (b *Bot) PollUpdates(handler func(Update)) {
	offset := 0

	for {
		updates, err := b.GetUpdates(offset)
		if err != nil {
			log.Printf("Error getting updates: %v", err)
			continue
		}

		for _, update := range updates {
			offset = update.UpdateID + 1
			handler(update)
		}
	}
}
