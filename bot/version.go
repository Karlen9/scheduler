package main

// Version is injected at build time via -ldflags from git tag.
// Falls back to "dev" if not set.
var Version = "1.3.0"

// Changelog is shown to users on /start. Update before each release.
var Changelog = `— Расписание: день, неделя, месяц — удобный обзор записей
— Ближайшая запись: карточка следующей тренировки
— Индивидуальное время для каждого дня в регулярных расписаниях
— Автоподтверждение записей, созданных тренером
— Фото клиента автоматически из Telegram-аватара
— Редактор фото с обрезкой и поворотом`
