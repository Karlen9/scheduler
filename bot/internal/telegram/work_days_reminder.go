package telegram

import (
	myI18n "scheduler-bot/internal/i18n"
	"scheduler-bot/internal/models"
)

/***************************************************************************************************
* WorkDaysReminderURL builds the mini-app link opened by the weekly "open your work days" reminder.
* It carries the specialist and language params exactly like the other admin web_app links, so the
* admin session resolves the same specialist.
*
* Parameters:
* - specialist: The specialist the reminder is for.
*
* Returns:
* - The absolute web app URL of the work-days settings page.
***************************************************************************************************/
func (h *Handler) WorkDaysReminderURL(specialist *models.Specialist) string {
	lang := specialist.Language
	if lang == "" {
		lang = "ru"
	}
	return h.WebAppURL + "/admin/settings/work-days?specialist=" + specialist.ID + "&lang=" + lang
}

/***************************************************************************************************
* SendWorkDaysReminder tells a dates-mode specialist, through their own bot, that next week has no
* open working days, with an inline web_app button that opens the work-days page.
*
* Parameters:
* - specialist: The specialist to remind (their Telegram user id is the recipient).
*
* Returns:
* - An error when Telegram rejects the message.
*
* Side effects:
* - Sends a Telegram message.
***************************************************************************************************/
func (h *Handler) SendWorkDaysReminder(specialist *models.Specialist) error {
	loc := myI18n.NewLocalizer(specialist.Language, "ru")
	_, err := h.Bot.SendWebAppButton(
		specialist.TelegramUserID,
		myI18n.T(loc, "WorkDays.ReminderText"),
		h.WorkDaysReminderURL(specialist),
		myI18n.T(loc, "WorkDays.ReminderButton"),
	)
	return err
}
