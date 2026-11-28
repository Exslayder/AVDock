import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";

import { api } from "../lib/api";
import { useI18n } from "../lib/i18n";
import type {
  AppInfo,
  BinariesInfo,
  Lang,
  Settings,
  Theme,
  UpdateReport,
  YtdlpStatus,
} from "../lib/types";
import { IconExternal, IconFolder, IconRefresh } from "./Icons";
import { RubberSegmented } from "./RubberSegmented";

type Notify = (message: string, kind?: "info" | "error" | "success") => void;

interface SettingsPageProps {
  settings: Settings;
  binaries: BinariesInfo | null;
  ytdlp: YtdlpStatus;
  appInfo: AppInfo | null;
  onSave: (settings: Settings) => Promise<void>;
  onRefresh: () => Promise<void>;
  notify: Notify;
}

export function SettingsPage({
  settings,
  binaries,
  ytdlp,
  appInfo,
  onSave,
  onRefresh,
  notify,
}: SettingsPageProps) {
  const { t, lang } = useI18n();
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<UpdateReport | null>(null);
  const [updatingYtdlp, setUpdatingYtdlp] = useState(false);
  const [updatingApp, setUpdatingApp] = useState(false);

  const localYtdlp = report?.ytdlpCurrent ?? binaries?.ytdlpVersion ?? ytdlp.version ?? null;
  const latestYtdlp = report?.ytdlpLatest ?? null;
  const ytdlpOutdated = Boolean(latestYtdlp && latestYtdlp !== localYtdlp);
  const appVersion = report?.appCurrent ?? appInfo?.version ?? "0.2.0";
  const appOutdated = Boolean(report?.appLatest);

  async function pickFolder(kind: "audioPath" | "videoPath") {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      defaultPath: settings[kind],
    });
    if (typeof selected === "string") {
      await onSave({ ...settings, [kind]: selected });
    }
  }

  async function changeLanguage(next: "ru" | "en") {
    await onSave({ ...settings, language: next });
  }

  async function toggleAutoUpdate() {
    await onSave({ ...settings, autoUpdate: !settings.autoUpdate });
  }

  async function checkAll() {
    setChecking(true);
    try {
      const result = await api.checkUpdates();
      setReport(result);
      const ytdlpNew = Boolean(result.ytdlpLatest && result.ytdlpLatest !== result.ytdlpCurrent);
      if (result.appLatest) {
        notify(t("set.appLatest", { version: result.appLatest }), "info");
      } else if (result.appError) {
        notify(t("set.appUpdateError"), "error");
      } else if (ytdlpNew) {
        notify(t("set.newVersion", { version: result.ytdlpLatest! }), "info");
      } else if (result.ytdlpLatest) {
        notify(t("set.allActual"), "success");
      }
    } catch (error) {
      notify(String(error), "error");
    } finally {
      setChecking(false);
    }
  }

  async function updateYtdlp() {
    setUpdatingYtdlp(true);
    try {
      const version = await api.installYtdlp();
      notify(t("toast.ytdlpInstalled", { version }), "success");
      await onRefresh();
      setReport((current) => (current ? { ...current, ytdlpCurrent: version } : current));
    } catch (error) {
      notify(String(error), "error");
    } finally {
      setUpdatingYtdlp(false);
    }
  }

  async function updateApp() {
    setUpdatingApp(true);
    try {
      await api.installAppUpdate();
    } catch (error) {
      const message = String(error);
      if (message === "no_update") {
        notify(t("set.allActual"), "success");
      } else {
        notify(`${t("update.error")}: ${message}`, "error");
      }
      setUpdatingApp(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t("set.title")}</h1>
      </header>

      <section className="card settings-card">
        <h2>{t("set.folders")}</h2>
        <FolderRow
          label={t("set.audio")}
          path={settings.audioPath}
          onChange={() => void pickFolder("audioPath")}
        />
        <FolderRow
          label={t("set.video")}
          path={settings.videoPath}
          onChange={() => void pickFolder("videoPath")}
        />
      </section>

      <section className="card settings-card">
        <h2>{t("set.language")}</h2>
        <RubberSegmented<Lang>
          options={[
            { value: "ru", label: "Русский" },
            { value: "en", label: "English" },
          ]}
          value={lang}
          onChange={(value) => void changeLanguage(value)}
          ariaLabel={t("set.language")}
        />
      </section>

      <section className="card settings-card">
        <h2>{t("set.appearance")}</h2>
        <div className="tool-row">
          <span className="tool-name">{t("set.theme")}</span>
          <RubberSegmented<Theme>
            options={[
              { value: "system", label: t("set.themeSystem") },
              { value: "light", label: t("set.themeLight") },
              { value: "dark", label: t("set.themeDark") },
            ]}
            value={settings.theme}
            onChange={(value) => void onSave({ ...settings, theme: value })}
            ariaLabel={t("set.theme")}
          />
        </div>
      </section>

      <section className="card settings-card">
        <div className="settings-head">
          <h2>{t("set.updates")}</h2>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void checkAll()}
            disabled={checking || updatingYtdlp || updatingApp}
          >
            <IconRefresh size={15} />
            {checking ? t("set.checking") : t("set.checkAll")}
          </button>
        </div>

        <div className="tool-row">
          <div className="tool-info">
            <span className="tool-name">{t("set.ytdlp")}</span>
            <span className="muted small">
              {localYtdlp ?? t("set.notFound")}
              {ytdlpOutdated ? ` → ${latestYtdlp}` : ""}
            </span>
          </div>
          {ytdlpOutdated && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void updateYtdlp()}
              disabled={updatingYtdlp}
            >
              {t("set.updateYtdlp")}
            </button>
          )}
        </div>

        <div className="tool-row">
          <div className="tool-info">
            <span className="tool-name">AVDock</span>
            <span className="muted small">
              {appOutdated
                ? t("set.appLatest", { version: report!.appLatest! })
                : report
                  ? t("set.allActual")
                  : t("set.notChecked")}
            </span>
          </div>
          {appOutdated && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void updateApp()}
              disabled={updatingApp}
            >
              {t("set.installApp")}
            </button>
          )}
        </div>

        <div className="tool-row">
          <div className="tool-info">
            <span className="tool-name">{t("set.ffmpeg")}</span>
            <span className="muted small">{binaries?.ffmpegVersion ?? t("set.notFound")}</span>
          </div>
        </div>

        <div className="tool-row">
          <div className="tool-info">
            <span className="tool-name">{t("set.autoUpdate")}</span>
            <span className="muted small">{t("set.autoUpdateHint")}</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.autoUpdate}
            className={`switch ${settings.autoUpdate ? "on" : ""}`}
            onClick={() => void toggleAutoUpdate()}
          >
            <span className="switch-knob" />
          </button>
        </div>
      </section>

      <section className="card settings-card">
        <h2>{t("set.about")}</h2>
        <div className="tool-row">
          <div className="tool-info">
            <span className="tool-name">AVDock</span>
            <span className="muted small">
              {t("set.version")} {appVersion}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void openUrl("https://github.com/Exslayder/AVDock")}
          >
            <IconExternal size={15} />
            {t("set.github")}
          </button>
        </div>
        <p className="muted small">{t("set.dataNote")}</p>
      </section>
    </div>
  );
}

function FolderRow({
  label,
  path,
  onChange,
}: {
  label: string;
  path: string;
  onChange: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="folder-row">
      <div className="folder-info">
        <span className="folder-label">{label}</span>
        <span className="folder-path" title={path}>
          {path || "—"}
        </span>
      </div>
      <button type="button" className="btn btn-ghost" onClick={onChange}>
        <IconFolder size={15} />
        {t("common.browse")}
      </button>
    </div>
  );
}
