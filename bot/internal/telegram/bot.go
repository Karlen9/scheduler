package telegram

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"strconv"
)

/***************************************************************************************************
* Defines the telegram api value used by the telegram bot layer.
*
* Usage context:
* - Reused by the telegram bot layer to keep shared values centralized.
***************************************************************************************************/
const telegramAPI = "https://api.telegram.org/bot"

/***************************************************************************************************
* Bot represents a Telegram bot.
***************************************************************************************************/
type Bot struct {
	Token    string
	Username string
	ID       int64 // Numeric Telegram user ID of the bot itself, populated from getMe.
}

// TelegramID returns the bot's own Telegram user ID. Used when filtering messages we ourselves
// posted (e.g. breadcrumbs inside a support topic) so we don't echo them back to the user.
func (b *Bot) TelegramID() int64 { return b.ID }

/***************************************************************************************************
* WebAppInfo holds web app URL.
***************************************************************************************************/
type WebAppInfo struct {
	URL string `json:"url"`
}

/***************************************************************************************************
* InlineKeyboardButton represents an inline keyboard button.
***************************************************************************************************/
type InlineKeyboardButton struct {
	Text         string      `json:"text"`
	WebApp       *WebAppInfo `json:"web_app,omitempty"`
	CallbackData string      `json:"callback_data,omitempty"`
	URL          string      `json:"url,omitempty"`
}

/***************************************************************************************************
* InlineKeyboardMarkup represents an inline keyboard.
***************************************************************************************************/
type InlineKeyboardMarkup struct {
	InlineKeyboard [][]InlineKeyboardButton `json:"inline_keyboard"`
}

/***************************************************************************************************
* KeyboardButton represents a single button on a persistent reply keyboard. Tapping a plain-text
* button sends that text back as a message; WebApp buttons open the given web app inline.
***************************************************************************************************/
type KeyboardButton struct {
	Text   string      `json:"text"`
	WebApp *WebAppInfo `json:"web_app,omitempty"`
}

/***************************************************************************************************
* ReplyKeyboardMarkup represents a persistent keyboard rendered below the chat input area.
***************************************************************************************************/
type ReplyKeyboardMarkup struct {
	Keyboard       [][]KeyboardButton `json:"keyboard"`
	ResizeKeyboard bool               `json:"resize_keyboard,omitempty"`
	IsPersistent   bool               `json:"is_persistent,omitempty"`
}

/***************************************************************************************************
* SendMessageRequest is the request body for sendMessage. ReplyMarkup is typed as any so callers
* can pass either an *InlineKeyboardMarkup or a *ReplyKeyboardMarkup.
***************************************************************************************************/
type SendMessageRequest struct {
	ChatID      int64  `json:"chat_id"`
	Text        string `json:"text"`
	ParseMode   string `json:"parse_mode,omitempty"`
	ReplyMarkup any    `json:"reply_markup,omitempty"`
}

/***************************************************************************************************
* EditMessageTextRequest is the request body for editMessageText.
***************************************************************************************************/
type EditMessageTextRequest struct {
	ChatID      int64                 `json:"chat_id"`
	MessageID   int                   `json:"message_id"`
	Text        string                `json:"text"`
	ParseMode   string                `json:"parse_mode,omitempty"`
	ReplyMarkup *InlineKeyboardMarkup `json:"reply_markup,omitempty"`
}

/***************************************************************************************************
* Update represents a Telegram update.
***************************************************************************************************/
type Update struct {
	UpdateID      int            `json:"update_id"`
	Message       *Message       `json:"message,omitempty"`
	CallbackQuery *CallbackQuery `json:"callback_query,omitempty"`
}

/***************************************************************************************************
* Message represents a Telegram message.
***************************************************************************************************/
type Message struct {
	MessageID       int    `json:"message_id"`
	Chat            Chat   `json:"chat"`
	From            *User  `json:"from,omitempty"`
	Text            string `json:"text,omitempty"`
	Caption         string `json:"caption,omitempty"`
	MessageThreadID int    `json:"message_thread_id,omitempty"`
	IsTopicMessage  bool   `json:"is_topic_message,omitempty"`
}

/***************************************************************************************************
* Chat represents a Telegram chat.
***************************************************************************************************/
type Chat struct {
	ID   int64  `json:"id"`
	Type string `json:"type,omitempty"`
}

/***************************************************************************************************
* User represents a Telegram user.
***************************************************************************************************/
type User struct {
	ID           int64  `json:"id"`
	FirstName    string `json:"first_name"`
	LastName     string `json:"last_name,omitempty"`
	Username     string `json:"username,omitempty"`
	LanguageCode string `json:"language_code,omitempty"`
}

/***************************************************************************************************
* CallbackQuery represents a callback query.
***************************************************************************************************/
type CallbackQuery struct {
	ID      string   `json:"id"`
	From    User     `json:"from"`
	Message *Message `json:"message,omitempty"`
	Data    string   `json:"data"`
}

/***************************************************************************************************
* GetUpdatesResponse is the response from getUpdates.
***************************************************************************************************/
type GetUpdatesResponse struct {
	OK     bool     `json:"ok"`
	Result []Update `json:"result"`
}

/***************************************************************************************************
* GetMeResponse is the response from getMe.
***************************************************************************************************/
type GetMeResponse struct {
	OK     bool `json:"ok"`
	Result struct {
		ID       int64  `json:"id"`
		Username string `json:"username"`
	} `json:"result"`
}

/***************************************************************************************************
* SetWebhookRequest is the request body for setWebhook.
***************************************************************************************************/
type SetWebhookRequest struct {
	URL         string `json:"url"`
	SecretToken string `json:"secret_token,omitempty"`
}

/***************************************************************************************************
* SetWebhookResponse is the response from setWebhook.
***************************************************************************************************/
type SetWebhookResponse struct {
	OK          bool   `json:"ok"`
	Result      bool   `json:"result"`
	Description string `json:"description,omitempty"`
}

/***************************************************************************************************
* SendMessageResponse is the response from sendMessage.
***************************************************************************************************/
type SendMessageResponse struct {
	OK     bool    `json:"ok"`
	Result Message `json:"result"`
}

/***************************************************************************************************
* NewBot creates a new Bot instance.
*
* Parameters:
* - token: Token used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
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
	bot.ID = result.Result.ID
	return bot, nil
}

/***************************************************************************************************
* GetUpdates fetches updates from Telegram.
*
* Parameters:
* - offset: Offset used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
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

/***************************************************************************************************
* DeleteWebhook removes the current webhook and optionally drops pending updates.
*
* Parameters:
* - dropPending: Drop pending used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
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

/***************************************************************************************************
* SetWebhook sets the webhook URL for the bot.
*
* Parameters:
* - url: Url used by the current operation.
* - secretToken: Secret token used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
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

/***************************************************************************************************
* GetWebhookInfo returns current webhook info for debugging.
*
* Parameters:
* - None.
*
* Returns:
* - The computed value for the current operation as (string, int, string).
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (b *Bot) GetWebhookInfo() (string, int, string) {
	resp, err := http.Get(telegramAPI + b.Token + "/getWebhookInfo")
	if err != nil {
		return "", 0, err.Error()
	}
	defer resp.Body.Close()

	var result struct {
		OK     bool `json:"ok"`
		Result struct {
			URL                string `json:"url"`
			PendingUpdateCount int    `json:"pending_update_count"`
			LastErrorMessage   string `json:"last_error_message"`
			LastErrorDate      int    `json:"last_error_date"`
		} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", 0, err.Error()
	}
	return result.Result.URL, result.Result.PendingUpdateCount, result.Result.LastErrorMessage
}

/***************************************************************************************************
* SendMessageHTML sends a message with HTML parse mode.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - text: Text used by the current operation.
* - replyMarkup: Reply markup used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (b *Bot) SendMessageHTML(chatID int64, text string, replyMarkup *InlineKeyboardMarkup) (*Message, error) {
	req := SendMessageRequest{
		ChatID:    chatID,
		Text:      text,
		ParseMode: "HTML",
	}
	if replyMarkup != nil {
		req.ReplyMarkup = replyMarkup
	}
	return b.sendMessageRequest(req)
}

/***************************************************************************************************
* SendMessageHTMLWithReplyKeyboard sends an HTML-parsed message and attaches a persistent reply
* keyboard. Passing nil keeps the current keyboard untouched.
***************************************************************************************************/
func (b *Bot) SendMessageHTMLWithReplyKeyboard(chatID int64, text string, replyKeyboard *ReplyKeyboardMarkup) (*Message, error) {
	req := SendMessageRequest{
		ChatID:    chatID,
		Text:      text,
		ParseMode: "HTML",
	}
	if replyKeyboard != nil {
		req.ReplyMarkup = replyKeyboard
	}
	return b.sendMessageRequest(req)
}

/***************************************************************************************************
* SendMessage sends a message.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - text: Text used by the current operation.
* - replyMarkup: Reply markup used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (b *Bot) SendMessage(chatID int64, text string, replyMarkup *InlineKeyboardMarkup) (*Message, error) {
	req := SendMessageRequest{
		ChatID: chatID,
		Text:   text,
	}
	if replyMarkup != nil {
		req.ReplyMarkup = replyMarkup
	}
	return b.sendMessageRequest(req)
}

/***************************************************************************************************
* Implements the send message request logic used by this module.
*
* Parameters:
* - req: Req used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (b *Bot) sendMessageRequest(req SendMessageRequest) (*Message, error) {
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

/***************************************************************************************************
* SetChatMenuButton sets a web_app menu button for a specific user chat.
*
* Parameters:
* - text: Text used by the current operation.
* - chatID: Identifier used to target the current record.
* - url: Url used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (b *Bot) SetChatMenuButton(chatID int64, text, url string) error {
	data := map[string]interface{}{
		"chat_id": chatID,
		"menu_button": map[string]interface{}{
			"type":    "web_app",
			"text":    text,
			"web_app": map[string]string{"url": url},
		},
	}
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}
	resp, err := http.Post(
		telegramAPI+b.Token+"/setChatMenuButton",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

/***************************************************************************************************
* EditMessageText edits a message's text.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - messageID: Identifier used to target the current record.
* - text: Text used by the current operation.
* - replyMarkup: Reply markup used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (b *Bot) EditMessageText(chatID int64, messageID int, text string, replyMarkup *InlineKeyboardMarkup) error {
	return b.editMessageText(chatID, messageID, text, "", replyMarkup)
}

// EditMessageTextHTML is the HTML-parse-mode counterpart of EditMessageText. Use it when the
// edited text contains Telegram HTML tags (<b>, <i>, <a>, ...). Falling back to the plain
// EditMessageText would make Telegram render those tags as literal text.
func (b *Bot) EditMessageTextHTML(chatID int64, messageID int, text string, replyMarkup *InlineKeyboardMarkup) error {
	return b.editMessageText(chatID, messageID, text, "HTML", replyMarkup)
}

func (b *Bot) editMessageText(chatID int64, messageID int, text, parseMode string, replyMarkup *InlineKeyboardMarkup) error {
	req := EditMessageTextRequest{
		ChatID:      chatID,
		MessageID:   messageID,
		Text:        text,
		ParseMode:   parseMode,
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

/***************************************************************************************************
* AnswerCallbackQuery answers a callback query.
*
* Parameters:
* - callbackQueryID: Identifier used to target the current record.
* - text: Text used by the current operation.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
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

/***************************************************************************************************
* SendNotification sends a plain notification message (no inline buttons).
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - text: Text used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (b *Bot) SendNotification(chatID int64, text string) (*Message, error) {
	return b.SendMessage(chatID, text, nil)
}

/***************************************************************************************************
* SendWebAppButton sends a message with web app button.
*
* Parameters:
* - text: Text used by the current operation.
* - chatID: Identifier used to target the current record.
* - webAppURL: Web app url used by the current operation.
* - buttonLabel: Button label used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (b *Bot) SendWebAppButton(chatID int64, text, webAppURL string, buttonLabel ...string) (*Message, error) {
	label := "📅"
	if len(buttonLabel) > 0 && buttonLabel[0] != "" {
		label = buttonLabel[0]
	}
	keyboard := &InlineKeyboardMarkup{
		InlineKeyboard: [][]InlineKeyboardButton{
			{
				{Text: label, WebApp: &WebAppInfo{URL: webAppURL}},
			},
		},
	}

	return b.SendMessage(chatID, text, keyboard)
}

/***************************************************************************************************
* SendPhoto sends a photo to a chat via multipart upload and returns the file_id and message_id.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - photoData: Photo data used by the current operation.
* - filename: Filename used by the current operation.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (b *Bot) SendPhoto(chatID int64, photoData []byte, filename string) (string, int, error) {
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	w.WriteField("chat_id", strconv.FormatInt(chatID, 10))

	part, err := w.CreateFormFile("photo", filename)
	if err != nil {
		return "", 0, fmt.Errorf("create form file: %w", err)
	}
	if _, err := part.Write(photoData); err != nil {
		return "", 0, fmt.Errorf("write photo data: %w", err)
	}
	w.Close()

	resp, err := http.Post(
		telegramAPI+b.Token+"/sendPhoto",
		w.FormDataContentType(),
		&buf,
	)
	if err != nil {
		return "", 0, err
	}
	defer resp.Body.Close()

	var result struct {
		OK     bool `json:"ok"`
		Result struct {
			MessageID int `json:"message_id"`
			Photo     []struct {
				FileID string `json:"file_id"`
			} `json:"photo"`
		} `json:"result"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", 0, err
	}
	if !result.OK {
		return "", 0, fmt.Errorf("sendPhoto failed: %s", result.Description)
	}
	if len(result.Result.Photo) == 0 {
		return "", 0, fmt.Errorf("sendPhoto returned no photo sizes")
	}

	/***************************************************************************************************
	* Use the largest photo size (last in the array).
	***************************************************************************************************/
	fileID := result.Result.Photo[len(result.Result.Photo)-1].FileID
	return fileID, result.Result.MessageID, nil
}

/***************************************************************************************************
* DeleteMessage deletes a message from a chat.
*
* Parameters:
* - chatID: Identifier used to target the current record.
* - messageID: Identifier used to target the current record.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (b *Bot) DeleteMessage(chatID int64, messageID int) error {
	data := map[string]interface{}{
		"chat_id":    chatID,
		"message_id": messageID,
	}
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	resp, err := http.Post(
		telegramAPI+b.Token+"/deleteMessage",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	var result struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return err
	}
	if !result.OK {
		return fmt.Errorf("deleteMessage failed: %s", result.Description)
	}
	return nil
}

/***************************************************************************************************
* GetFile downloads a file from Telegram by file_id. Returns file bytes and content type.
*
* Parameters:
* - fileID: Identifier used to target the current record.
*
* Returns:
* - The requested result together with an error when the operation cannot complete successfully.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
func (b *Bot) GetFile(fileID string) ([]byte, string, error) {
	/***************************************************************************************************
	* Step 1: get file path via POST (avoids URL-encoding issues with file_id).
	***************************************************************************************************/
	body := map[string]string{"file_id": fileID}
	jsonBody, _ := json.Marshal(body)
	resp, err := http.Post(
		telegramAPI+b.Token+"/getFile",
		"application/json",
		bytes.NewBuffer(jsonBody),
	)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}

	var result struct {
		OK     bool `json:"ok"`
		Result struct {
			FilePath string `json:"file_path"`
		} `json:"result"`
		Description string `json:"description"`
	}
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return nil, "", err
	}
	if !result.OK {
		return nil, "", fmt.Errorf("getFile failed: %s", result.Description)
	}

	/***************************************************************************************************
	* Step 2: download the file.
	***************************************************************************************************/
	fileURL := fmt.Sprintf("https://api.telegram.org/file/bot%s/%s", b.Token, result.Result.FilePath)
	fileResp, err := http.Get(fileURL)
	if err != nil {
		return nil, "", err
	}
	defer fileResp.Body.Close()

	data, err := io.ReadAll(fileResp.Body)
	if err != nil {
		return nil, "", err
	}

	contentType := fileResp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "image/jpeg"
	}

	return data, contentType, nil
}

/***************************************************************************************************
* PollUpdates starts polling for updates.
*
* Parameters:
* - handler: Handler used by the current operation.
*
* Returns:
* - No direct return value; work is exposed through side effects.
*
* Side effects:
* - May call Telegram APIs, mutate in-memory workflow state, or persist specialist data.
***************************************************************************************************/
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

// CreateForumTopic creates a new topic in a forum supergroup and returns its message_thread_id.
// Requires the bot to be admin in the group with the "Manage Topics" right.
func (b *Bot) CreateForumTopic(chatID int64, name string) (int, error) {
	data := map[string]interface{}{
		"chat_id": chatID,
		"name":    truncateTopicName(name),
	}
	jsonData, err := json.Marshal(data)
	if err != nil {
		return 0, err
	}
	resp, err := http.Post(
		telegramAPI+b.Token+"/createForumTopic",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	var result struct {
		OK     bool `json:"ok"`
		Result struct {
			MessageThreadID int `json:"message_thread_id"`
		} `json:"result"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, err
	}
	if !result.OK {
		return 0, fmt.Errorf("createForumTopic failed: %s", result.Description)
	}
	// Defence-in-depth: Telegram always returns a positive message_thread_id on success. If we
	// ever see 0 it means a malformed response or a silent failure — treat as an error so
	// callers don't persist a zero topic_id that would later cause messages to leak into the
	// group's general chat.
	if result.Result.MessageThreadID <= 0 {
		return 0, fmt.Errorf("createForumTopic returned invalid message_thread_id: %d", result.Result.MessageThreadID)
	}
	return result.Result.MessageThreadID, nil
}

// CloseForumTopic closes a topic so no new replies can be posted (history preserved).
func (b *Bot) CloseForumTopic(chatID int64, threadID int) error {
	data := map[string]interface{}{
		"chat_id":           chatID,
		"message_thread_id": threadID,
	}
	jsonData, _ := json.Marshal(data)
	resp, err := http.Post(
		telegramAPI+b.Token+"/closeForumTopic",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var result struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return err
	}
	if !result.OK {
		return fmt.Errorf("closeForumTopic failed: %s", result.Description)
	}
	return nil
}

// ReopenForumTopic un-archives a previously closed topic so new messages can be posted into it.
// Returns a structured error when Telegram says the topic is gone (isTopicMissingError picks
// this up so the caller can fall back to creating a brand-new topic).
func (b *Bot) ReopenForumTopic(chatID int64, threadID int) error {
	data := map[string]interface{}{
		"chat_id":           chatID,
		"message_thread_id": threadID,
	}
	jsonData, _ := json.Marshal(data)
	resp, err := http.Post(
		telegramAPI+b.Token+"/reopenForumTopic",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var result struct {
		OK          bool   `json:"ok"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return err
	}
	if !result.OK {
		return fmt.Errorf("reopenForumTopic failed: %s", result.Description)
	}
	return nil
}

// SendMessageToTopic posts a plain (HTML-parsed) message into a specific topic inside a forum supergroup.
func (b *Bot) SendMessageToTopic(chatID int64, threadID int, text string) (*Message, error) {
	// Refuse to send without a real topic id — a zero value would silently post into the
	// group's general chat, which for a support-relay deployment is a privacy bug
	// (conversations with one user become visible to anyone in the group).
	if threadID <= 0 {
		return nil, fmt.Errorf("SendMessageToTopic requires a positive message_thread_id, got %d", threadID)
	}
	data := map[string]interface{}{
		"chat_id":           chatID,
		"message_thread_id": threadID,
		"text":              text,
		"parse_mode":        "HTML",
	}
	jsonData, err := json.Marshal(data)
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
		return nil, fmt.Errorf("sendMessage to topic failed")
	}
	return &result.Result, nil
}

// CopyMessage reposts a message from one chat to another (preserving media, captions, etc.)
// without the "Forwarded from" header. threadID may be 0 for a plain chat destination.
func (b *Bot) CopyMessage(toChatID int64, fromChatID int64, messageID int, threadID int) (int, error) {
	data := map[string]interface{}{
		"chat_id":      toChatID,
		"from_chat_id": fromChatID,
		"message_id":   messageID,
	}
	if threadID > 0 {
		data["message_thread_id"] = threadID
	}
	jsonData, err := json.Marshal(data)
	if err != nil {
		return 0, err
	}
	resp, err := http.Post(
		telegramAPI+b.Token+"/copyMessage",
		"application/json",
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	var result struct {
		OK     bool `json:"ok"`
		Result struct {
			MessageID int `json:"message_id"`
		} `json:"result"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, err
	}
	if !result.OK {
		return 0, fmt.Errorf("copyMessage failed: %s", result.Description)
	}
	return result.Result.MessageID, nil
}

// truncateTopicName keeps the topic name within Telegram's 128-char limit.
func truncateTopicName(name string) string {
	const max = 128
	runes := []rune(name)
	if len(runes) <= max {
		return name
	}
	return string(runes[:max-1]) + "…"
}
