package db

import (
	"fmt"
	"strings"
)

var isPostgres bool

// Q translates ? placeholders to $1,$2,... for Postgres. No-op for SQLite.
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

// BoolVal returns a driver-appropriate boolean value for SQL.
func BoolVal(b bool) interface{} {
	if isPostgres {
		return b
	}
	if b {
		return 1
	}
	return 0
}

// DateNow returns the SQL expression for "current date".
func DateNow() string {
	if isPostgres {
		return "CURRENT_DATE"
	}
	return "date('now')"
}
