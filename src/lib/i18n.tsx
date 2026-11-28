import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { Lang } from "./types";

const ru = {
  "nav.downloads": "Загрузки",
  "nav.converter": "Конвертер",
  "nav.settings": "Настройки",
  "nav.sections": "Разделы",
  "nav.menu": "Меню",

  "common.browse": "Изменить",
  "common.retry": "Повторить",

  "downloads.title": "Загрузки",
  "downloads.subtitle": "YouTube и SoundCloud. Одна ссылка на строку.",
  "downloads.placeholder":
    "https://www.youtube.com/watch?v=…\nhttps://soundcloud.com/…",
  "downloads.mp4": "MP4",
  "downloads.webm": "WEBM",
  "downloads.mp3": "MP3 · 320",
  "downloads.download": "Скачать",
  "downloads.format": "Формат",
  "downloads.soundcloudHint": "SoundCloud — только аудио, MP3 · 320",
  "downloads.queue": "Очередь",
  "downloads.empty": "Очередь пуста",
  "downloads.emptyHint": "Вставь ссылку и выбери формат",
  "downloads.activeCount": "в работе: {count}",
  "downloads.speed": "Скорость",
  "downloads.clear": "Убрать завершённые",
  "downloads.showAll": "Показать все",
  "downloads.collapse": "Свернуть",
  "downloads.openFolder": "Открыть папку",
  "downloads.cancel": "Отменить",
  "downloads.remove": "Удалить",
  "downloads.eta": "осталось {time}",
  "downloads.playlist": "{index} из {total}",

  "status.queued": "В очереди",
  "status.downloading": "Загрузка",
  "status.processing": "Обработка",
  "status.done": "Готово",
  "status.error": "Ошибка",
  "status.canceled": "Отменено",

  "ytdlp.failed": "Не удалось скачать движок",
  "ytdlp.notify.title": "Установка движка",
  "ytdlp.notify.subtitle": "Видео и музыка",
  "ytdlp.notify.done": "Движок готов",
  "ytdlp.notify.errorHint": "Проверь интернет",

  "err.ytdlpMissing": "Движок загрузок не установлен. Установи его в настройках.",
  "err.ffmpegMissing": "ffmpeg не найден в сборке.",
  "err.outputDir": "Не выбрана папка для сохранения.",
  "err.invalidUrl": "Ссылка должна начинаться с http:// или https://",
  "err.exitCode": "Движок загрузок завершился с кодом {code}",
  "err.fileNotFound": "Файл не найден.",
  "err.alreadyMp4": "Этот файл уже MP4.",
  "err.ffmpegFailed": "ffmpeg не смог сконвертировать файл.",
  "err.sameFormat": "Файл уже в этом формате.",
  "err.noVideo": "В файле нет видеодорожки.",
  "err.noAudio": "В файле нет аудиодорожки.",
  "err.badTarget": "Неподдерживаемый формат.",
  "err.busy": "Уже выполняется другая операция.",
  "err.generic": "Не удалось выполнить операцию",
  "err.canceled": "Операция отменена.",

  "warn.title": "С ошибками: {count}",
  "warn.age": "18+ контент, нужны cookies",
  "warn.unavailable": "Видео недоступно или приватное",

  "toast.added": "Добавлено в очередь: {count}",
  "toast.ytdlpInstalled": "Движок загрузок обновлён: {version}",

  "conv.title": "Конвертер",
  "conv.subtitle": "Видео и аудио в популярные форматы. Для H.264 сначала NVENC, при ошибке — CPU.",
  "conv.format": "Формат",
  "conv.target.mp4": "MP4",
  "conv.target.mkv": "MKV",
  "conv.target.webm": "WEBM",
  "conv.target.mov": "MOV",
  "conv.target.mp3": "MP3",
  "conv.target.m4a": "M4A",
  "conv.target.wav": "WAV",
  "conv.codecH264": "H.264 · NVENC / CPU",
  "conv.codecVp9": "VP9 · Opus",
  "conv.codecMp3": "MP3 · 320 kbps",
  "conv.codecM4a": "AAC · 256 kbps",
  "conv.codecWav": "PCM · 16-bit",
  "conv.sameFormat": "Файл уже в этом формате",
  "conv.dropActive": "Отпусти файл",
  "conv.dropTitle": "Перетащи файл сюда",
  "conv.dropHint": "или нажми, чтобы выбрать",
  "conv.converting": "Конвертируем",
  "conv.doneTitle": "Готово",
  "conv.errorHint": "Нажми, чтобы выбрать другой файл",
  "conv.history": "История конвертаций",
  "conv.clearHistory": "Очистить",
  "conv.cancel": "Отменить",
  "conv.phaseNvenc": "NVENC",
  "conv.phaseCpu": "CPU",
  "conv.phaseVp9": "VP9",
  "conv.phaseAudio": "Аудио",
  "conv.openFolder": "Открыть папку",

  "set.title": "Настройки",
  "set.folders": "Папки сохранения",
  "set.audio": "Музыка · MP3",
  "set.video": "Видео · MP4 / WEBM",
  "set.language": "Язык интерфейса",
  "set.appearance": "Оформление",
  "set.theme": "Тема",
  "set.themeSystem": "Системная",
  "set.themeLight": "Светлая",
  "set.themeDark": "Тёмная",
  "set.updates": "Обновления",
  "set.ytdlp": "Движок загрузок",
  "set.ffmpeg": "ffmpeg",
  "set.notFound": "не найден",
  "set.about": "О программе",
  "set.version": "Версия",
  "set.checkAll": "Проверить обновления",
  "set.checking": "Проверяем…",
  "set.updateYtdlp": "Обновить движок",
  "set.autoUpdate": "Обновлять автоматически при запуске",
  "set.autoUpdateHint":
    "Проверяет движок загрузок и AVDock при запуске, ставит обновления и перезапускает.",
  "set.appLatest": "Доступна версия {version}",
  "set.installApp": "Обновить и перезапустить",
  "set.allActual": "Всё актуально",
  "set.notChecked": "не проверялось",
  "set.newVersion": "Доступна версия {version}",
  "set.appUpdateError": "Не удалось проверить обновления",
  "set.github": "Открыть GitHub",
  "set.dataNote":
    "Настройки, движок загрузок и временные файлы лежат в папке data рядом с программой. Если она недоступна для записи, используется профиль Windows.",

  "update.downloading": "Скачиваем обновление AVDock",
  "update.installing": "Устанавливаем обновление…",
  "update.error": "Не удалось обновить AVDock",
} as const;

export type TKey = keyof typeof ru;

const en: Record<TKey, string> = {
  "nav.downloads": "Downloads",
  "nav.converter": "Converter",
  "nav.settings": "Settings",
  "nav.sections": "Sections",
  "nav.menu": "Menu",

  "common.browse": "Change",
  "common.retry": "Retry",

  "downloads.title": "Downloads",
  "downloads.subtitle": "YouTube and SoundCloud. One link per line.",
  "downloads.placeholder":
    "https://www.youtube.com/watch?v=…\nhttps://soundcloud.com/…",
  "downloads.mp4": "MP4",
  "downloads.webm": "WEBM",
  "downloads.mp3": "MP3 · 320",
  "downloads.download": "Download",
  "downloads.format": "Format",
  "downloads.soundcloudHint": "SoundCloud is audio only, MP3 · 320",
  "downloads.queue": "Queue",
  "downloads.empty": "Queue is empty",
  "downloads.emptyHint": "Paste a link and pick a format",
  "downloads.activeCount": "active: {count}",
  "downloads.speed": "Speed",
  "downloads.clear": "Clear finished",
  "downloads.showAll": "Show all",
  "downloads.collapse": "Collapse",
  "downloads.openFolder": "Open folder",
  "downloads.cancel": "Cancel",
  "downloads.remove": "Remove",
  "downloads.eta": "{time} left",
  "downloads.playlist": "{index} of {total}",

  "status.queued": "Queued",
  "status.downloading": "Downloading",
  "status.processing": "Processing",
  "status.done": "Done",
  "status.error": "Error",
  "status.canceled": "Canceled",

  "ytdlp.failed": "Failed to download the engine",
  "ytdlp.notify.title": "Installing the engine",
  "ytdlp.notify.subtitle": "Video and music",
  "ytdlp.notify.done": "Engine is ready",
  "ytdlp.notify.errorHint": "Check the connection",

  "err.ytdlpMissing": "The download engine is not installed. Install it in Settings.",
  "err.ffmpegMissing": "ffmpeg was not found in the bundle.",
  "err.outputDir": "No output folder selected.",
  "err.invalidUrl": "The link must start with http:// or https://",
  "err.exitCode": "The download engine exited with code {code}",
  "err.fileNotFound": "File not found.",
  "err.alreadyMp4": "This file is already MP4.",
  "err.ffmpegFailed": "ffmpeg could not convert the file.",
  "err.sameFormat": "The file is already in this format.",
  "err.noVideo": "The file has no video track.",
  "err.noAudio": "The file has no audio track.",
  "err.badTarget": "Unsupported format.",
  "err.busy": "Another operation is already running.",
  "err.generic": "The operation failed",
  "err.canceled": "Operation canceled.",

  "warn.title": "Finished with errors: {count}",
  "warn.age": "18+ content, cookies required",
  "warn.unavailable": "Video is unavailable or private",

  "toast.added": "Added to queue: {count}",
  "toast.ytdlpInstalled": "Download engine updated: {version}",

  "conv.title": "Converter",
  "conv.subtitle": "Video and audio into popular formats. H.264 goes through NVENC first, then CPU.",
  "conv.format": "Format",
  "conv.target.mp4": "MP4",
  "conv.target.mkv": "MKV",
  "conv.target.webm": "WEBM",
  "conv.target.mov": "MOV",
  "conv.target.mp3": "MP3",
  "conv.target.m4a": "M4A",
  "conv.target.wav": "WAV",
  "conv.codecH264": "H.264 · NVENC / CPU",
  "conv.codecVp9": "VP9 · Opus",
  "conv.codecMp3": "MP3 · 320 kbps",
  "conv.codecM4a": "AAC · 256 kbps",
  "conv.codecWav": "PCM · 16-bit",
  "conv.sameFormat": "The file is already in this format",
  "conv.dropActive": "Release to drop",
  "conv.dropTitle": "Drop your file here",
  "conv.dropHint": "or click to choose",
  "conv.converting": "Converting",
  "conv.doneTitle": "Done",
  "conv.errorHint": "Click to choose another file",
  "conv.history": "Conversion history",
  "conv.clearHistory": "Clear",
  "conv.cancel": "Cancel",
  "conv.phaseNvenc": "NVENC",
  "conv.phaseCpu": "CPU",
  "conv.phaseVp9": "VP9",
  "conv.phaseAudio": "Audio",
  "conv.openFolder": "Open folder",

  "set.title": "Settings",
  "set.folders": "Save folders",
  "set.audio": "Music · MP3",
  "set.video": "Video · MP4 / WEBM",
  "set.language": "Interface language",
  "set.appearance": "Appearance",
  "set.theme": "Theme",
  "set.themeSystem": "System",
  "set.themeLight": "Light",
  "set.themeDark": "Dark",
  "set.updates": "Updates",
  "set.ytdlp": "Download engine",
  "set.ffmpeg": "ffmpeg",
  "set.notFound": "not found",
  "set.about": "About",
  "set.version": "Version",
  "set.checkAll": "Check for updates",
  "set.checking": "Checking…",
  "set.updateYtdlp": "Update engine",
  "set.autoUpdate": "Update automatically on startup",
  "set.autoUpdateHint":
    "Checks the download engine and AVDock on startup, installs updates and restarts.",
  "set.appLatest": "Version {version} is available",
  "set.installApp": "Update and restart",
  "set.allActual": "Everything is up to date",
  "set.notChecked": "not checked",
  "set.newVersion": "Version {version} is available",
  "set.appUpdateError": "Failed to check for updates",
  "set.github": "Open GitHub",
  "set.dataNote":
    "Settings, the download engine and temporary files live in the data folder next to the app. If it is not writable, the Windows profile is used instead.",

  "update.downloading": "Downloading AVDock update",
  "update.installing": "Installing update…",
  "update.error": "Failed to update AVDock",
};

const dicts: Record<Lang, Record<TKey, string>> = { ru, en };

type Vars = Record<string, string | number>;

export function translate(lang: Lang, key: TKey, vars?: Vars): string {
  const template = dicts[lang][key] ?? dicts.ru[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

interface I18nValue {
  lang: Lang;
  t: (key: TKey, vars?: Vars) => string;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nValue>({
  lang: "ru",
  t: (key, vars) => translate("ru", key, vars),
  setLang: () => undefined,
});

export function I18nProvider({
  lang,
  setLang,
  children,
}: {
  lang: Lang;
  setLang: (lang: Lang) => void;
  children: ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({
      lang,
      t: (key, vars) => translate(lang, key, vars),
      setLang,
    }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
