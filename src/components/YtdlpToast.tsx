import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { useI18n } from "../lib/i18n";
import type { YtdlpStatus } from "../lib/types";
import { IconAlert, IconCheck } from "./Icons";

type Phase = "thinking" | "progress" | "done" | "error";

// Long enough for the gooey dots to read as "starting", short enough not to
// hold the real progress back.
const THINK_MS = 420;
const DONE_MS = 1700;

const SIZE = {
  bubble: { width: 64, height: 40 },
  card: { width: 348, height: 66 },
  error: { width: 372, height: 66 },
  done: { width: 196, height: 40 },
} as const;

const RING = 94.25; // 2 * PI * 15

/**
 * Floating download island for the yt-dlp binary. It pops up in the bottom
 * right as a gooey three-dot bubble, morphs into a progress card (ring +
 * percent) while the engine downloads, then collapses into a green check.
 * A failed install stays open with a retry button.
 */
export function YtdlpToast({
  ytdlp,
  onRetry,
}: {
  ytdlp: YtdlpStatus;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase | null>(null);
  const previous = useRef<YtdlpStatus["state"]>(ytdlp.state);

  useEffect(() => {
    if (ytdlp.state === "downloading") {
      setPhase("thinking");
      previous.current = ytdlp.state;
      const timer = window.setTimeout(() => setPhase("progress"), THINK_MS);
      return () => window.clearTimeout(timer);
    }

    if (ytdlp.state === "error") {
      setPhase("error");
      previous.current = ytdlp.state;
      return undefined;
    }

    if (ytdlp.state === "ready") {
      if (previous.current === "downloading") {
        setPhase("done");
        previous.current = ytdlp.state;
        const timer = window.setTimeout(() => setPhase(null), DONE_MS);
        return () => window.clearTimeout(timer);
      }
      previous.current = ytdlp.state;
      setPhase(null);
      return undefined;
    }

    // "missing" stays silent: the startup installer picks it up in a moment.
    previous.current = ytdlp.state;
    setPhase(null);
    return undefined;
  }, [ytdlp.state]);

  const percent = Math.max(0, Math.min(100, Math.round(ytdlp.percent ?? 0)));
  const size =
    phase === "done"
      ? SIZE.done
      : phase === "error"
        ? SIZE.error
        : phase === "progress"
          ? SIZE.card
          : SIZE.bubble;
  const expanded = phase === "progress" || phase === "error" || phase === "done";

  return (
    <div className="yt-toast" aria-live="polite">
      <AnimatePresence>
        {phase && (
          <motion.div
            key="yt-island"
            className="yt-island"
            initial={{ opacity: 0, y: 14, scale: 0.86, ...SIZE.bubble }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              width: size.width,
              height: size.height,
              borderRadius: expanded ? 18 : 20,
            }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{
              width: { type: "spring", stiffness: 420, damping: 28 },
              height: { type: "spring", stiffness: 320, damping: 24 },
              default: { duration: 0.22, ease: [0.2, 0, 0, 1] },
            }}
          >
            <div className={`yt-layer yt-goo-layer ${phase === "thinking" ? "on" : ""}`}>
              <svg className="yt-goo-defs" aria-hidden="true">
                <filter id="ytdlp-goo" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="blur" />
                  <feColorMatrix
                    in="blur"
                    mode="matrix"
                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"
                  />
                </filter>
              </svg>
              <span className="yt-goo">
                <i />
                <i />
                <i />
              </span>
            </div>

            <div className={`yt-layer yt-progress-layer ${phase === "progress" ? "on" : ""}`}>
              <svg className="yt-ring" viewBox="0 0 36 36" aria-hidden="true">
                <circle className="yt-ring-bg" cx="18" cy="18" r="15" />
                <circle
                  className="yt-ring-fg"
                  cx="18"
                  cy="18"
                  r="15"
                  style={{ strokeDashoffset: RING * (1 - percent / 100) }}
                />
              </svg>
              <span className="yt-copy">
                <b>{t("ytdlp.notify.title")}</b>
                <span>{t("ytdlp.notify.subtitle")}</span>
              </span>
              <span className="yt-pct">{percent}%</span>
            </div>

            <div className={`yt-layer yt-error-layer ${phase === "error" ? "on" : ""}`}>
              <span className="yt-warn">
                <IconAlert size={14} />
              </span>
              <span className="yt-copy">
                <b>{t("ytdlp.failed")}</b>
                <span>{t("ytdlp.notify.errorHint")}</span>
              </span>
              <button type="button" className="yt-retry" onClick={onRetry}>
                {t("common.retry")}
              </button>
            </div>

            <div className={`yt-layer yt-done-layer ${phase === "done" ? "on" : ""}`}>
              <span className="yt-check">
                <IconCheck size={13} />
              </span>
              <b>{t("ytdlp.notify.done")}</b>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
