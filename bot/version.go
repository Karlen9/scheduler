package main

// Version is injected at build time via -ldflags from git tag.
// Falls back to "dev" if not set.
var Version = "dev"

// Changelog is shown to users on /start. Update before each release.
var Changelog = `— Лист ожидания: встаньте в очередь на занятое время
— Уведомления о свободных местах
— Настройка уведомлений в профиле`
