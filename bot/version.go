package main

// Version is injected at build time via -ldflags from git tag.
// Falls back to "dev" if not set.
var Version = "1.2.0"

// Changelog is shown to users on /start. Update before each release.
var Changelog = `— Фото профиля: загрузите фото для тренера и клиента
— Регулярные тренировки: настройте повторяющееся расписание
— Запись клиентов тренером с подтверждением
— Обновлённая навигация с вкладками
— Мгновенные переходы между страницами`
