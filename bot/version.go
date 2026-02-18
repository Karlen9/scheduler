package main

// Version is injected at build time via -ldflags from git tag.
// Falls back to "dev" if not set.
var Version = "1.3.0"

// Changelog content is now managed via i18n locale files (ChangelogContent key).
// Update the locale files (active.ru.json, active.en.json) before each release.
