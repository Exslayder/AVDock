import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import type { UnlistenFn } from "@tauri-apps/api/event";

import { api, events } from "./lib/api";
import { baseName, humanizeError } from "./lib/format";
import { I18nProvider, translate } from "./lib/i18n";
import type {
  AppInfo,
  AppUpdateStatus,
  BinariesInfo,
  ConversionRecord,
  ConvertProgress,
  ConvertTarget,
  Lang,
  MediaKind,
  Page,
  QueueItem,
  Settings,
  YtdlpStatus,
} from "./lib/types";
import { TopNav } from "./components/TopNav";
import { Downloads } from "./components/Downloads";
import { Converter } from "./components/Converter";
import { SettingsPage } from "./components/SettingsPage";
import { YtdlpToast } from "./components/YtdlpToast";
import { Meter } from "./components/Meter";
import { IconAlert, IconCheck, IconLogo } from "./components/Icons";

type ToastKind = "info" | "error" | "success";
interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

// Covers every subset the UI renders: Latin, Cyrillic, digits and the
// punctuation the Russian copy uses.
const FONT_SAMPLE =
  'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz 0123456789 АаБбВвГгДдЕеЁёЖжЗзИиЙйКкЛлМмНнОоПпРрСсТтУуФфХхЦцЧчШшЩщЪъЫыЬьЭэЮюЯя —–…«»';

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [page, setPage] = useState<Page>("downloads");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [ytdlp, setYtdlp] = useState<YtdlpStatus>({ state: "missing" });
  const [binaries, setBinaries] = useState<BinariesInfo | null>(null);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [convert, setConvert] = useState<ConvertProgress | null>(null);
  const [history, setHistory] = useState<ConversionRecord[]>([]);
  const lastTarget = useRef<ConvertTarget>("mp4");
  const historyId = useRef(0);
  const [appUpdate, setAppUpdate] = useState<AppUpdateStatus | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const notify = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++toastId.current;
    setToasts((current) => [...current, { id, message, kind }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const dismissConvert = useCallback(() => setConvert(null), []);
  const clearHistory = useCallback(() => setHistory([]), []);

  useEffect(() => {
    let cancelled = false;

    const loadFonts = async () => {
      try {
        if ("fonts" in document) {
          // Without an explicit sample, FontFaceSet.load() only pulls the
          // subset that contains a space (the Latin one). The interface is
          // Cyrillic, so that face arrived after the first paint and the
          // text visibly switched fonts. Ask for Latin + Cyrillic at once.
          const specs = [
            '400 16px "Geist Variable"',
            '500 16px "Geist Variable"',
            '600 16px "Geist Variable"',
            '600 32px "Bricolage Grotesque Variable"',
          ];
          await Promise.allSettled(
            specs.map((spec) => document.fonts.load(spec, FONT_SAMPLE)),
          );

          // load() can resolve before the set settles; wait for the rest.
          const deadline = performance.now() + 3000;
          while (document.fonts.status !== "loaded" && performance.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 30));
          }
          await document.fonts.ready;
        }
      } catch {
        /* fall through: show the app with fallback fonts */
      }
      if (!cancelled) setFontsReady(true);
    };

    void loadFonts();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshBinaries = useCallback(async () => {
    try {
      setBinaries(await api.getBinaries());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    const unlisteners: UnlistenFn[] = [];

    (async () => {
      const [initialSettings, initialQueue, initialYtdlp, initialAppInfo] = await Promise.all([
        api.getSettings(),
        api.getQueue(),
        api.ytdlpState(),
        api.appInfo(),
      ]);
      if (disposed) return;
      document.documentElement.dataset.design = "reactbits";
      setSettings(initialSettings);
      setQueue(initialQueue);
      setYtdlp(initialYtdlp);
      setAppInfo(initialAppInfo);
      document.documentElement.lang = initialSettings.language;
      // Version probing starts separate processes (yt-dlp takes about a second),
      // so it must not delay the first paint.
      void refreshBinaries();

      const listeners = await Promise.all([
        events.onQueue((items) => setQueue(items)),
        events.onYtdlp((status) => {
          setYtdlp(status);
          if (status.state === "ready") void refreshBinaries();
        }),
        events.onConvert((progress) => {
          setConvert(progress);
          if (progress.phase === "done" && progress.output) {
            const path = progress.output;
            const ext = path.split(".").pop()?.toLowerCase() as ConvertTarget | undefined;
            const recordTarget = ext || lastTarget.current;
            setHistory((current) => [
              {
                id: ++historyId.current,
                name: baseName(path),
                path,
                target: recordTarget,
                at: Date.now(),
              },
              ...current.filter((item) => item.path !== path),
            ]);
          }
        }),
        events.onAppUpdate((status) => setAppUpdate(status)),
      ]);
      if (disposed) {
        listeners.forEach((unlisten) => unlisten());
      } else {
        unlisteners.push(...listeners);
      }
    })().catch((error) => {
      console.error(error);
    });

    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [refreshBinaries]);

  useEffect(() => {
    if (settings) document.documentElement.lang = settings.language;
  }, [settings]);

  useEffect(() => {
    if (!settings) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const resolved =
        settings.theme === "system" ? (media.matches ? "dark" : "light") : settings.theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.design = "reactbits";
      document.documentElement.style.colorScheme = resolved;
    };

    apply();
    if (settings.theme === "system") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
  }, [settings]);

  useEffect(() => {
    let frame = 0;
    let lastEvent: PointerEvent | null = null;

    const handleMove = (event: PointerEvent) => {
      lastEvent = event;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!lastEvent) return;
        const target = lastEvent.target as Element | null;
        const card = target?.closest?.(".card, .queue-item, .history-item, .drop-zone");
        if (!(card instanceof HTMLElement)) return;
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--rb-mx", `${lastEvent.clientX - rect.left}px`);
        card.style.setProperty("--rb-my", `${lastEvent.clientY - rect.top}px`);
      });
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const lang: Lang = settings?.language ?? "ru";
  const t = useCallback(
    (key: Parameters<typeof translate>[1], vars?: Parameters<typeof translate>[2]) =>
      translate(lang, key, vars),
    [lang],
  );

  async function persist(next: Settings) {
    setSettings(next);
    try {
      await api.saveSettings(next);
    } catch (error) {
      notify(String(error), "error");
    }
  }

  async function handleEnqueue(urls: string[], kind: MediaKind): Promise<boolean> {
    try {
      const ids = await api.enqueue(urls, kind);
      notify(t("toast.added", { count: ids.length }), "success");
      return true;
    } catch (error) {
      notify(humanizeError(t, String(error)) || t("err.generic"), "error");
      return false;
    }
  }

  async function handleCancel(id: number) {
    try {
      await api.cancelItem(id);
    } catch (error) {
      notify(String(error), "error");
    }
  }

  async function handleRemove(id: number) {
    try {
      await api.removeItem(id);
    } catch (error) {
      notify(String(error), "error");
    }
  }

  async function handleClearFinished() {
    try {
      await api.clearFinished();
    } catch (error) {
      notify(String(error), "error");
    }
  }

  async function handleRetryYtdlp() {
    try {
      await api.installYtdlp();
    } catch {
      /* the ytdlp-status event reports the failure in the notification */
    }
  }

  async function handleConvertStart(file: string, target: ConvertTarget) {
    lastTarget.current = target;
    const phase =
      target === "webm"
        ? "vp9"
        : target === "mp3" || target === "m4a" || target === "wav"
          ? "audio"
          : "nvenc";
    setConvert({ running: true, phase, percent: 0, file });
    try {
      await api.convertStart(file, target);
    } catch (error) {
      notify(humanizeError(t, String(error)) || t("err.generic"), "error");
    }
  }

  async function handleConvertCancel() {
    try {
      await api.convertCancel();
    } catch (error) {
      notify(String(error), "error");
    }
  }

  if (!settings || !fontsReady) {
    return (
      <div className="splash">
        <span className="brand-mark">
          <IconLogo size={22} />
        </span>
        <span>AVDock</span>
      </div>
    );
  }

  const activeCount = queue.filter(
    (item) =>
      item.status === "queued" || item.status === "downloading" || item.status === "processing",
  ).length;

  return (
    <I18nProvider lang={settings.language} setLang={(next) => void persist({ ...settings, language: next })}>
      <MotionConfig reducedMotion="user">
      <div className="app">
        <header className="topbar">
          <TopNav page={page} onNavigate={setPage} activeCount={activeCount} />
        </header>
        <main className="content">
          {appUpdate &&
            (appUpdate.phase === "downloading" || appUpdate.phase === "installing") && (
              <div className="update-bar">
                <span className="update-bar-text">
                  {appUpdate.phase === "downloading"
                    ? t("update.downloading")
                    : t("update.installing")}
                  {appUpdate.version ? ` · v${appUpdate.version}` : ""}
                </span>
                <Meter value={appUpdate.percent ?? 0} />
              </div>
            )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            >
              {page === "downloads" && (
                <Downloads
                  queue={queue}
                  onEnqueue={handleEnqueue}
                  onCancel={handleCancel}
                  onRemove={handleRemove}
                  onClearFinished={handleClearFinished}
                  notify={notify}
                />
              )}
              {page === "converter" && (
                <Converter
                  convert={convert}
                  history={history}
                  onStart={handleConvertStart}
                  onCancel={handleConvertCancel}
                  onDismiss={dismissConvert}
                  onClearHistory={clearHistory}
                />
              )}
              {page === "settings" && (
                <SettingsPage
                  settings={settings}
                  binaries={binaries}
                  ytdlp={ytdlp}
                  appInfo={appInfo}
                  onSave={persist}
                  onRefresh={refreshBinaries}
                  notify={notify}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <div className="toasts">
          <YtdlpToast ytdlp={ytdlp} onRetry={handleRetryYtdlp} />
          <AnimatePresence initial={false}>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                className={`toast toast-${toast.kind}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              >
                {toast.kind === "error" ? <IconAlert size={16} /> : <IconCheck size={16} />}
                <span>{toast.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      </MotionConfig>
    </I18nProvider>
  );
}
