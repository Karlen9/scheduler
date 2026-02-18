package i18n

import (
	"context"
	"embed"
	"encoding/json"

	"github.com/nicksnyder/go-i18n/v2/i18n"
	"golang.org/x/text/language"
)

//go:embed locales/active.*.json
var localeFS embed.FS

var bundle *i18n.Bundle

type localizerKey struct{}

func Init() error {
	bundle = i18n.NewBundle(language.Russian)
	bundle.RegisterUnmarshalFunc("json", json.Unmarshal)

	if _, err := bundle.LoadMessageFileFS(localeFS, "locales/active.ru.json"); err != nil {
		return err
	}
	if _, err := bundle.LoadMessageFileFS(localeFS, "locales/active.en.json"); err != nil {
		return err
	}
	return nil
}

func NewLocalizer(langs ...string) *i18n.Localizer {
	return i18n.NewLocalizer(bundle, langs...)
}

func Default() *i18n.Localizer {
	return i18n.NewLocalizer(bundle, "ru")
}

func WithLocalizer(ctx context.Context, loc *i18n.Localizer) context.Context {
	return context.WithValue(ctx, localizerKey{}, loc)
}

func L(ctx context.Context) *i18n.Localizer {
	if loc, ok := ctx.Value(localizerKey{}).(*i18n.Localizer); ok {
		return loc
	}
	return Default()
}

func T(loc *i18n.Localizer, messageID string) string {
	s, err := loc.Localize(&i18n.LocalizeConfig{MessageID: messageID})
	if err != nil {
		return messageID
	}
	return s
}

func Tf(loc *i18n.Localizer, messageID string, data map[string]interface{}) string {
	s, err := loc.Localize(&i18n.LocalizeConfig{
		MessageID:    messageID,
		TemplateData: data,
	})
	if err != nil {
		return messageID
	}
	return s
}

func Tp(loc *i18n.Localizer, messageID string, count int, data map[string]interface{}) string {
	s, err := loc.Localize(&i18n.LocalizeConfig{
		MessageID:    messageID,
		PluralCount:  count,
		TemplateData: data,
	})
	if err != nil {
		return messageID
	}
	return s
}
