import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

type Phase = "idle" | "loading" | "success";

interface LoadingSuccessButtonProps {
  label: string;
  successLabel: string;
  icon: ReactNode;
  disabled?: boolean;
  onAction: () => Promise<boolean>;
}

const IDLE_WIDTH = 152;
const LOADING_WIDTH = 42;
const SUCCESS_WIDTH = 132;
const MIN_LOADING_MS = 1200;
const SUCCESS_HOLD_MS = 1400;

export function LoadingSuccessButton({
  label,
  successLabel,
  icon,
  disabled = false,
  onAction,
}: LoadingSuccessButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const timers = useRef<number[]>([]);
  const reduceMotion = useReducedMotion();

  const clearTimers = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    timers.current.push(timer);
  };

  async function handleClick() {
    if (disabled || phase !== "idle") return;

    clearTimers();
    setPhase("loading");
    const startedAt = performance.now();
    const succeeded = await onAction();
    const remaining = Math.max(0, MIN_LOADING_MS - (performance.now() - startedAt));

    if (!succeeded) {
      schedule(() => setPhase("idle"), remaining);
      return;
    }

    schedule(() => {
      setPhase("success");
      schedule(() => setPhase("idle"), SUCCESS_HOLD_MS);
    }, remaining);
  }

  const width =
    phase === "loading" ? LOADING_WIDTH : phase === "success" ? SUCCESS_WIDTH : IDLE_WIDTH;

  const widthTransition = reduceMotion
    ? { duration: 0 }
    : ({ type: "spring", stiffness: 300, damping: 22 } as const);

  return (
    <motion.button
      type="button"
      className={`submit-pill ${phase === "success" ? "is-success" : ""}`}
      disabled={disabled || phase !== "idle"}
      onClick={() => void handleClick()}
      animate={{ width }}
      transition={widthTransition}
      aria-live="polite"
      aria-label={phase === "success" ? successLabel : label}
    >
      <motion.span
        className="submit-label"
        initial={false}
        animate={{
          opacity: phase === "idle" ? 1 : 0,
          y: phase === "idle" ? 0 : 14,
        }}
        transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
      >
        {icon}
        <span>{label}</span>
      </motion.span>

      <motion.span
        className="submit-spinner"
        initial={false}
        animate={{
          opacity: phase === "loading" ? 1 : 0,
          scale: phase === "loading" ? 1 : 0.65,
        }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.2, 0, 0, 1] }}
        aria-hidden
      >
        <span className="submit-spinner-ring" />
      </motion.span>

      <motion.span
        className="submit-done"
        initial={false}
        animate={{
          opacity: phase === "success" ? 1 : 0,
          y: phase === "success" ? 0 : 12,
        }}
        transition={{
          duration: reduceMotion ? 0 : 0.22,
          delay: phase === "success" && !reduceMotion ? 0.1 : 0,
          ease: [0.2, 0, 0, 1],
        }}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" fill="none">
          <path
            className="submit-tick"
            d="m5 12.5 4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>{successLabel}</span>
      </motion.span>
    </motion.button>
  );
}
