package db

import (
	"fmt"
	"strings"
)

/***************************************************************************************************
* Defines the is postgres value used by the database layer.
*
* Usage context:
* - Reused by the database layer to keep shared values centralized.
***************************************************************************************************/
var isPostgres bool

/***************************************************************************************************
* Q translates ? placeholders to $1,$2,... for Postgres. No-op for SQLite.
*
* Parameters:
* - query: Query used by the current operation.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func Q(query string) string {
	if !isPostgres {
		return query
	}
	var result strings.Builder
	n := 0
	for _, c := range query {
		if c == '?' {
			n++
			fmt.Fprintf(&result, "$%d", n)
		} else {
			result.WriteRune(c)
		}
	}
	return result.String()
}

/***************************************************************************************************
* BoolVal returns an integer boolean value for SQL (INTEGER columns).
*
* Parameters:
* - b: B used by the current operation.
*
* Returns:
* - The computed value for the current operation as int.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func BoolVal(b bool) int {
	if b {
		return 1
	}
	return 0
}

/***************************************************************************************************
* DateNow returns the SQL expression for "current date".
*
* Parameters:
* - None.
*
* Returns:
* - The computed value for the current operation as string.
*
* Side effects:
* - Reads from or writes to the shared database connection.
***************************************************************************************************/
func DateNow() string {
	if isPostgres {
		return "CURRENT_DATE"
	}
	return "date('now')"
}

// isUniqueConstraintError returns true when err represents a UNIQUE constraint violation
// from either the modernc SQLite driver or the pgx/v5 Postgres driver.
func isUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	// modernc/sqlite: "constraint failed: UNIQUE constraint failed: ..."
	// pgx/pgconn: "ERROR: duplicate key value violates unique constraint ..." (SQLSTATE 23505)
	return strings.Contains(msg, "unique constraint") ||
		strings.Contains(msg, "duplicate key value") ||
		strings.Contains(msg, "23505")
}
