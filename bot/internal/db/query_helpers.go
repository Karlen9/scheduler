package db

import "fmt"

/***************************************************************************************************
* Implements the session type select columns logic used by this module.
*
* Parameters:
* - alias: Alias used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func sessionTypeSelectColumns(alias string) string {
	return fmt.Sprintf(
		`%s.id, %s.specialist_id, %s.type, %s.name, %s.duration_minutes, %s.price, %s.currency, %s.image_url, %s.sessions_count, %s.is_active`,
		alias, alias, alias, alias, alias, alias, alias, alias, alias, alias,
	)
}

/***************************************************************************************************
* Implements the client metadata select columns logic used by this module.
*
* Parameters:
* - alias: Alias used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func clientMetadataSelectColumns(alias string) string {
	return fmt.Sprintf(`COALESCE(%s.photo_url, ''), COALESCE(%s.display_name, '')`, alias, alias)
}
