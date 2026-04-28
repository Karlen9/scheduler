package telegram

import (
	"fmt"

	"github.com/nicksnyder/go-i18n/v2/i18n"
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

var supportedCommandLanguages = []string{"ru", "en"}

type commandDefinition struct {
	Command        string
	DescriptionKey string
}

var bookingClientCommandDefinitions = []commandDefinition{
	{Command: "start", DescriptionKey: "Command.Start"},
	{Command: "help", DescriptionKey: "Command.Help"},
	{Command: "language", DescriptionKey: "Command.Language"},
}

var bookingSpecialistCommandDefinitions = []commandDefinition{
	{Command: "start", DescriptionKey: "Command.Start"},
	{Command: "admin", DescriptionKey: "Command.Admin"},
	{Command: "profile", DescriptionKey: "Command.Profile"},
	{Command: "help", DescriptionKey: "Command.Help"},
	{Command: "language", DescriptionKey: "Command.Language"},
}

var masterUserCommandDefinitions = []commandDefinition{
	{Command: "start", DescriptionKey: "Command.Start"},
	{Command: "menu", DescriptionKey: "Command.Menu"},
	{Command: "language", DescriptionKey: "Command.Language"},
	{Command: "help", DescriptionKey: "Command.Help"},
	{Command: "cancel", DescriptionKey: "Command.Cancel"},
	{Command: "replacetoken", DescriptionKey: "Command.ReplaceToken"},
}

var masterAdminExtraCommandDefinitions = []commandDefinition{
	{Command: "admin", DescriptionKey: "Command.MasterAdmin"},
	{Command: "specialists", DescriptionKey: "Command.Specialists"},
	{Command: "stats", DescriptionKey: "Command.Stats"},
}

/***************************************************************************************************
* RegisterSpecialistBotCommands refreshes the specialist bot's command menu for both client and
* owner audiences. Telegram exposes the owner-specific set only in the specialist's private chat.
***************************************************************************************************/
func RegisterSpecialistBotCommands(bot *Bot, specialist *models.Specialist) error {
	if specialist == nil {
		return fmt.Errorf("specialist is nil")
	}

	clientScope := &BotCommandScope{Type: "all_private_chats"}
	ownerScope := &BotCommandScope{
		Type:   "chat_member",
		ChatID: specialist.TelegramUserID,
		UserID: specialist.TelegramUserID,
	}

	for _, languageCode := range supportedCommandLanguages {
		loc := myI18n.NewLocalizer(languageCode)
		if err := bot.SetMyCommands(localizeCommands(loc, bookingClientCommandDefinitions), clientScope, languageCode); err != nil {
			return fmt.Errorf("set client commands (%s): %w", languageCode, err)
		}
		if err := bot.SetMyCommands(localizeCommands(loc, bookingSpecialistCommandDefinitions), ownerScope, languageCode); err != nil {
			return fmt.Errorf("set specialist commands (%s): %w", languageCode, err)
		}
	}

	return nil
}

/***************************************************************************************************
* RegisterMasterBotCommands refreshes the onboarding bot's command menu for regular users and for
* each configured admin account.
***************************************************************************************************/
func RegisterMasterBotCommands(bot *Bot, adminIDs []int64) error {
	for _, languageCode := range supportedCommandLanguages {
		loc := myI18n.NewLocalizer(languageCode)
		userCommands := localizeCommands(loc, masterUserCommandDefinitions)
		if err := bot.SetMyCommands(userCommands, &BotCommandScope{Type: "all_private_chats"}, languageCode); err != nil {
			return fmt.Errorf("set master user commands (%s): %w", languageCode, err)
		}

		adminCommands := append([]BotCommand{}, userCommands...)
		adminCommands = append(adminCommands, localizeCommands(loc, masterAdminExtraCommandDefinitions)...)
		for _, adminID := range adminIDs {
			scope := &BotCommandScope{Type: "chat_member", ChatID: adminID, UserID: adminID}
			if err := bot.SetMyCommands(adminCommands, scope, languageCode); err != nil {
				return fmt.Errorf("set master admin commands (%s, %d): %w", languageCode, adminID, err)
			}
		}
	}

	return nil
}

func localizeCommands(loc *i18n.Localizer, defs []commandDefinition) []BotCommand {
	commands := make([]BotCommand, 0, len(defs))
	for _, def := range defs {
		commands = append(commands, BotCommand{
			Command:     def.Command,
			Description: myI18n.T(loc, def.DescriptionKey),
		})
	}
	return commands
}
