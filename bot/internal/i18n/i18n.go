package i18n

import (
	"context"
	"embed"
	"encoding/json"

	"github.com/nicksnyder/go-i18n/v2/i18n"
	"golang.org/x/text/language"
)

//go:embed locales/active.*.json
/***************************************************************************************************
* Defines the locale fs value used by the current module.
*
* Usage context:
* - Reused by the current module to keep shared values centralized.
***************************************************************************************************/
var localeFS embed.FS

/***************************************************************************************************
* Defines the bundle value used by the current module.
*
* Usage context:
* - Reused by the current module to keep shared values centralized.
***************************************************************************************************/
var bundle *i18n.Bundle

/***************************************************************************************************
* Defines the localizer key type used by the current module.
***************************************************************************************************/
type localizerKey struct{}

/***************************************************************************************************
* Implements the init logic used by this module.
*
* Parameters:
* - None.
*
* Returns:
* - An error when the operation cannot complete successfully.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
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

/***************************************************************************************************
* Creates localizer.
*
* Parameters:
* - langs: Langs used by the current operation.
*
* Returns:
* - The computed value for the current operation as *i18n.Localizer.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
func NewLocalizer(langs ...string) *i18n.Localizer {
	return i18n.NewLocalizer(bundle, langs...)
}

/***************************************************************************************************
* Implements the default logic used by this module.
*
* Parameters:
* - None.
*
* Returns:
* - The computed value for the current operation as *i18n.Localizer.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
func Default() *i18n.Localizer {
	return i18n.NewLocalizer(bundle, "ru")
}

/***************************************************************************************************
* Implements the with localizer logic used by this module.
*
* Parameters:
* - ctx: Context used for cancellation, deadlines, and request-scoped values.
* - loc: Loc used by the current operation.
*
* Returns:
* - The computed value for the current operation as context.Context.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
func WithLocalizer(ctx context.Context, loc *i18n.Localizer) context.Context {
	return context.WithValue(ctx, localizerKey{}, loc)
}

/***************************************************************************************************
* Implements the l logic used by this module.
*
* Parameters:
* - ctx: Context used for cancellation, deadlines, and request-scoped values.
*
* Returns:
* - The computed value for the current operation as *i18n.Localizer.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
func L(ctx context.Context) *i18n.Localizer {
	if loc, ok := ctx.Value(localizerKey{}).(*i18n.Localizer); ok {
		return loc
	}
	return Default()
}

/***************************************************************************************************
* Implements the t logic used by this module.
*
* Parameters:
* - loc: Loc used by the current operation.
* - messageID: Identifier used to target the current record.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
func T(loc *i18n.Localizer, messageID string) string {
	s, err := loc.Localize(&i18n.LocalizeConfig{MessageID: messageID})
	if err != nil {
		return messageID
	}
	return s
}

/***************************************************************************************************
* Implements the tf logic used by this module.
*
* Parameters:
* - loc: Loc used by the current operation.
* - messageID: Identifier used to target the current record.
* - data: Input data consumed by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
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

/***************************************************************************************************
* Implements the tp logic used by this module.
*
* Parameters:
* - loc: Loc used by the current operation.
* - messageID: Identifier used to target the current record.
* - count: Count used by the current operation.
* - data: Input data consumed by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - Keeps work scoped to the current module unless downstream helpers perform I/O.
***************************************************************************************************/
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
