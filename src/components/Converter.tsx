import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { animate, svg } from "animejs";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { getCurrentWebview } from "@tauri-apps/api/webview";

import { useI18n } from "../lib/i18n";
import { baseName, humanizeError } from "../lib/format";
import type { ConversionRecord, ConvertProgress, ConvertTarget } from "../lib/types";
import {
  IconAlert,
  IconDownload,
  IconFilm,
  IconFolder,
  IconMusic,
  IconX,
} from "./Icons";
import { RubberSegmented, type RubberOption } from "./RubberSegmented";

const videoTargets: ConvertTarget[] = ["mp4", "mkv", "webm", "mov"];
const audioTargets: ConvertTarget[] = ["mp3", "m4a", "wav"];

const mediaExtensions = [
  "webm",
  "mkv",
  "mov",
  "avi",
  "ts",
  "flv",
  "mp4",
  "m4v",
  "mp3",
  "m4a",
  "wav",
  "flac",
  "ogg",
  "aac",
  "opus",
];

const mediaPattern = new RegExp(`\\.(${mediaExtensions.join("|")})$`, "i");

const RING_RADIUS = 54;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

interface ConverterProps {
  convert: ConvertProgress | null;
  history: ConversionRecord[];
  onStart: (file: string, target: ConvertTarget) => Promise<void>;
  onCancel: () => Promise<void>;
  onDismiss: () => void;
  onClearHistory: () => void;
}

function DoneMark() {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    if (!pathRef.current) return;
    animate(svg.createDrawable(pathRef.current), {
      draw: "0 1",
      duration: 550,
      ease: "outQuad",
    });
  }, []);

  return (
    <svg className="drop-check" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        ref={pathRef}
        d="m4.5 12.5 4.5 4.5L19.5 6.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RollLine({ text, small = false }: { text: string; small?: boolean }) {
  return (
    <div className={`drop-line ${small ? "small" : ""}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export function Converter({
  convert,
  history,
  onStart,
  onCancel,
  onDismiss,
  onClearHistory,
}: ConverterProps) {
  const { t } = useI18n();
  const [target, setTarget] = useState<ConvertTarget>("mp4");
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [displayPercent, setDisplayPercent] = useState(0);

  const handlers = useRef({ target, onStart });
  handlers.current = { target, onStart };

  const backendRunning = Boolean(convert?.running);
  const backendDone = convert?.phase === "done";
  const progress = Math.max(0, Math.min(100, convert?.percent ?? 0));

  const hasError = Boolean(localError) || convert?.phase === "error";
  const canceled = !hasError && convert?.phase === "canceled";
  const finishingUp = !hasError && backendDone && displayPercent < 100;
  const running = (backendRunning || finishingUp) && !hasError;
  const done = !hasError && backendDone && displayPercent >= 100;
  const errorText =
    localError ?? (convert?.phase === "error" ? humanizeError(t, convert.error) : "");

  // Step the displayed percentage by at most 1 per animation frame so the
  // counter and ring always advance unit-by-unit (1, 2, 3… 100) without
  // jumping by 10/20/30 when FFmpeg reports coarse progress chunks.
  useEffect(() => {
    if (hasError || canceled || (!backendRunning && !backendDone)) {
      setDisplayPercent(0);
      return;
    }

    const targetValue = backendDone ? 100 : progress;
    if (displayPercent >= targetValue) {
      return;
    }

    let frame = 0;
    const tick = () => {
      setDisplayPercent((previous) => {
        const goal = backendDone ? 100 : progress;
        const diff = goal - previous;
        if (diff <= 0) return previous;
        const step = Math.min(1, Math.max(0.25, diff * 0.12));
        const next = previous + step;
        return goal - next < 0.2 ? goal : next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [backendRunning, backendDone, progress, hasError, canceled, displayPercent]);

  useEffect(() => {
    if (!localError) return;
    const timer = window.setTimeout(() => setLocalError(null), 6000);
    return () => window.clearTimeout(timer);
  }, [localError]);

  useEffect(() => {
    if (!convert) return;
    if (!done && convert.phase !== "error" && convert.phase !== "canceled") {
      return;
    }
    const timer = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(timer);
  }, [done, convert, onDismiss]);

  async function startConversion(path: string) {
    const { target: currentTarget, onStart: start } = handlers.current;
    const extension = path.split(".").pop()?.toLowerCase() ?? "";

    if (extension === currentTarget) {
      setLocalError(t("conv.sameFormat"));
      return;
    }

    setLocalError(null);
    setDisplayPercent(0);
    await start(path, currentTarget);
  }

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === "enter" || payload.type === "over") {
          setDragging(true);
          return;
        }
        setDragging(false);
        if (payload.type === "drop") {
          const media = payload.paths.find((path) => mediaPattern.test(path));
          if (media && !convert?.running) void startConversion(media);
        }
      })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => undefined);

    return () => unlisten?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convert?.running]);

  async function pick() {
    if (running) return;
    const selected = await openDialog({
      multiple: false,
      directory: false,
      filters: [
        {
          name: "Video",
          extensions: ["webm", "mkv", "mov", "avi", "ts", "flv", "mp4", "m4v"],
        },
        { name: "Audio", extensions: ["mp3", "m4a", "wav", "flac", "ogg", "aac", "opus"] },
        { name: "All files", extensions: ["*"] },
      ],
    });
    if (typeof selected === "string") {
      await startConversion(selected);
    }
  }

  const phaseLabel =
    convert?.phase === "nvenc"
      ? t("conv.phaseNvenc")
      : convert?.phase === "cpu"
        ? t("conv.phaseCpu")
        : convert?.phase === "vp9"
          ? t("conv.phaseVp9")
          : convert?.phase === "audio"
            ? t("conv.phaseAudio")
            : "";

  const codecHint =
    target === "webm"
      ? t("conv.codecVp9")
      : target === "mp3"
        ? t("conv.codecMp3")
        : target === "m4a"
          ? t("conv.codecM4a")
          : target === "wav"
            ? t("conv.codecWav")
            : t("conv.codecH264");

  const formatOptions: RubberOption<ConvertTarget>[] = [
    ...videoTargets,
    ...audioTargets,
  ].map((value) => ({
    value,
    label: t(`conv.target.${value}`),
    icon: audioTargets.includes(value) ? <IconMusic size={15} /> : <IconFilm size={15} />,
  }));

  let title: string;
  let subtitle: string;

  if (dragging) {
    title = t("conv.dropActive");
    subtitle = t("conv.dropHint");
  } else if (hasError) {
    title = t("status.error");
    subtitle = errorText || t("conv.errorHint");
  } else if (running) {
    title = `${t("conv.converting")} ${baseName(convert?.file ?? "")}`.trim();
    subtitle = [t(`conv.target.${target}`), phaseLabel].filter(Boolean).join(" · ");
  } else if (done) {
    title = t("conv.doneTitle");
    subtitle = baseName(convert?.output ?? "");
  } else if (canceled) {
    title = t("status.canceled");
    subtitle = t("conv.errorHint");
  } else {
    title = t("conv.dropTitle");
    subtitle = t("conv.dropHint");
  }

  const zoneState = dragging
    ? "dragging"
    : hasError
      ? "error"
      : running
        ? "running"
        : done
          ? "done"
          : "";

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t("conv.title")}</h1>
          <p>{t("conv.subtitle")}</p>
        </div>
      </header>

      <section className="card converter-format-card">
        <div className="convert-format">
          <div className="convert-format-head">
            <p className="section-label">{t("conv.format")}</p>
            <span className="muted small">{codecHint}</span>
          </div>
          <RubberSegmented<ConvertTarget>
            className="convert-formats"
            options={formatOptions}
            value={target}
            onChange={(value) => {
              setTarget(value);
              setLocalError(null);
            }}
            ariaLabel={t("conv.format")}
            disabled={running}
            stretch
          />
        </div>
      </section>

      <section
        className={`drop-zone ${zoneState}`}
        role="button"
        tabIndex={0}
        aria-label={title}
        onClick={() => void pick()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void pick();
          }
        }}
      >
        <div className="drop-core">
          <svg className="drop-ring" viewBox="0 0 120 120" aria-hidden>
            <circle className="drop-ring-track" cx="60" cy="60" r={RING_RADIUS} />
            <circle
              className="drop-ring-arc"
              cx="60"
              cy="60"
              r={RING_RADIUS}
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - displayPercent / 100)}
            />
          </svg>

          {running && !hasError ? (
            <span className="drop-percent">{Math.round(displayPercent)}</span>
          ) : done ? (
            <DoneMark />
          ) : hasError ? (
            <IconAlert size={28} />
          ) : (
            <IconDownload size={30} />
          )}
        </div>

        <div className="drop-lines">
          <RollLine text={title} />
          <RollLine text={subtitle} small />
        </div>
      </section>

      {backendRunning && !hasError && (
        <div className="drop-actions">
          <button
            type="button"
            className="btn btn-danger"
            onClick={(event) => {
              event.stopPropagation();
              void onCancel();
            }}
          >
            <IconX size={15} />
            {t("conv.cancel")}
          </button>
        </div>
      )}

      {history.length > 0 && (
        <section className="convert-history">
          <div className="convert-history-head">
            <h2>{t("conv.history")}</h2>
            <button type="button" className="btn btn-ghost" onClick={onClearHistory}>
              {t("conv.clearHistory")}
            </button>
          </div>
          <ul className="history-list">
            {history.map((item) => (
              <li key={item.id} className="history-item">
                <span className="history-icon">
                  {audioTargets.includes(item.target) ? (
                    <IconMusic size={16} />
                  ) : (
                    <IconFilm size={16} />
                  )}
                </span>
                <div className="history-info">
                  <span className="history-name">{item.name}</span>
                  <span className="history-meta">{t(`conv.target.${item.target}`)}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void revealItemInDir(item.path).catch(() => undefined)}
                >
                  <IconFolder size={14} />
                  {t("conv.openFolder")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
