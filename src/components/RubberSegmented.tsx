import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";

export interface RubberOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

interface RubberSegmentedProps<T extends string> {
  options: RubberOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  stretch?: boolean;
  disabled?: boolean;
  className?: string;
}

interface Spring {
  x: number;
  v: number;
  t: number;
  k: number;
  c: number;
}

const spring = (x = 0, k = 600, c = 44): Spring => ({ x, v: 0, t: x, k, c });

const stepSpring = (s: Spring, dt: number) => {
  const acceleration = -s.k * (s.x - s.t) - s.c * s.v;
  s.v += acceleration * dt;
  s.x += s.v * dt;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/**
 * Rubber Dock style selector: one pill whose leading edge is stiff and trailing
 * edge is lazy, so moving between options stretches it like rubber. The pill
 * also gets a little shorter as it stretches, keeping its area.
 */
export function RubberSegmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  stretch = false,
  disabled = false,
  className = "",
}: RubberSegmentedProps<T>) {
  const innerRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const springs = useRef({ left: spring(), right: spring(), height: spring() });
  const pops = useRef<Spring[]>([]);
  const baseIconRefs = useRef<Array<HTMLElement | null>>([]);
  const topIconRefs = useRef<Array<HTMLElement | null>>([]);
  const geometry = useRef({ itemWidth: 1, itemHeight: 38, rowWidth: 1 });
  const frameRef = useRef(0);
  const lastFrame = useRef(0);
  const initialized = useRef(false);
  const optionsRef = useRef(options);
  const valueRef = useRef(value);
  const reduceMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  optionsRef.current = options;
  valueRef.current = value;

  const render = useCallback(() => {
    const { left, right, height } = springs.current;
    const { itemHeight, rowWidth } = geometry.current;
    const width = Math.max(right.x - left.x, 24);
    const heightNow = Math.max(height.x, 8);
    const top = (itemHeight - heightNow) / 2;

    if (pillRef.current) {
      pillRef.current.style.width = `${width}px`;
      pillRef.current.style.height = `${heightNow}px`;
      pillRef.current.style.borderRadius = `${heightNow / 2}px`;
      pillRef.current.style.transform = `translate3d(${left.x}px, ${top}px, 0)`;
    }

    if (topRef.current) {
      const rightGap = Math.max(0, rowWidth - (left.x + width));
      const bottomGap = Math.max(0, itemHeight - top - heightNow);
      topRef.current.style.clipPath = `inset(${Math.max(0, top)}px ${rightGap}px ${Math.max(
        0,
        bottomGap,
      )}px ${Math.max(0, left.x)}px round ${heightNow / 2}px)`;
    }

    pops.current.forEach((pop, index) => {
      const transform = `scale(${clamp(pop.x, 0.72, 1.28)})`;
      const base = baseIconRefs.current[index];
      const incoming = topIconRefs.current[index];
      if (base) base.style.transform = transform;
      if (incoming) incoming.style.transform = transform;
    });
  }, []);

  const loop = useCallback(
    (now: number) => {
      const delta = Math.min((now - lastFrame.current) / 1000, 1 / 30);
      lastFrame.current = now;

      const { left, right, height } = springs.current;
      stepSpring(left, delta);
      stepSpring(right, delta);

      const { itemWidth, itemHeight } = geometry.current;
      const width = Math.max(right.x - left.x, 24);
      height.t = itemHeight * clamp(Math.sqrt(itemWidth / width), 0.66, 1.1);
      stepSpring(height, delta);
      pops.current.forEach((pop) => stepSpring(pop, delta));

      render();

      const settled =
        Math.abs(left.x - left.t) < 0.12 &&
        Math.abs(left.v) < 0.12 &&
        Math.abs(right.x - right.t) < 0.12 &&
        Math.abs(right.v) < 0.12 &&
        Math.abs(height.x - height.t) < 0.06 &&
        Math.abs(height.v) < 0.06 &&
        pops.current.every(
          (pop) => Math.abs(pop.x - pop.t) < 0.01 && Math.abs(pop.v) < 0.01,
        );

      if (settled) {
        frameRef.current = 0;
        return;
      }
      frameRef.current = requestAnimationFrame(loop);
    },
    [render],
  );

  const kick = useCallback(() => {
    if (frameRef.current) return;
    lastFrame.current = performance.now();
    frameRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const layout = useCallback(
    (snap: boolean) => {
      const inner = innerRef.current;
      if (!inner) return;

      const index = optionsRef.current.findIndex((option) => option.value === valueRef.current);
      const button = buttonRefs.current[index];
      if (!button) return;

      while (pops.current.length < optionsRef.current.length) {
        pops.current.push(spring(1, 520, 16));
      }

      const itemHeight = inner.clientHeight;
      const rowWidth = inner.clientWidth;
      const itemWidth = button.offsetWidth || 1;
      geometry.current = { itemHeight, rowWidth, itemWidth };

      const { left, right, height } = springs.current;
      const targetLeft = button.offsetLeft;
      const targetRight = targetLeft + button.offsetWidth;

      if (!initialized.current) {
        initialized.current = true;
        left.x = left.t = targetLeft;
        right.x = right.t = targetRight;
        height.x = height.t = itemHeight;
        pops.current.forEach((pop) => {
          pop.x = pop.t = 1;
          pop.v = 0;
        });
        render();
        if (pillRef.current) pillRef.current.style.opacity = "1";
        return;
      }

      if (snap) {
        left.x = left.t = targetLeft;
        right.x = right.t = targetRight;
        height.x = height.t = itemHeight;
        render();
        return;
      }

      if (Math.abs(left.t - targetLeft) < 0.5 && Math.abs(right.t - targetRight) < 0.5) {
        return;
      }

      const direction = Math.sign(
        (targetLeft + targetRight) / 2 - (left.x + right.x) / 2,
      );

      if (direction > 0) {
        left.k = 150;
        left.c = 16;
        right.k = 640;
        right.c = 38;
      } else if (direction < 0) {
        left.k = 640;
        left.c = 38;
        right.k = 150;
        right.c = 16;
      } else {
        left.k = 600;
        left.c = 44;
        right.k = 600;
        right.c = 44;
      }

      left.t = targetLeft;
      right.t = targetRight;

      if (reduceMotion.current) {
        left.x = left.t;
        right.x = right.t;
        height.x = height.t = itemHeight;
        render();
        return;
      }

      const pop = pops.current[index];
      if (pop) pop.v -= 3.2;
      kick();
    },
    [kick, render],
  );

  useLayoutEffect(() => {
    layout(false);
  });

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    const observer = new ResizeObserver(() => layout(true));
    observer.observe(inner);
    buttonRefs.current.forEach((button) => {
      if (button) observer.observe(button);
    });

    return () => observer.disconnect();
  }, [layout, options.length]);

  useEffect(() => {
    let disposed = false;

    const handleResize = () => layout(true);
    const handleFonts = () => layout(true);

    window.addEventListener("resize", handleResize);
    document.fonts?.addEventListener?.("loadingdone", handleFonts);

    const frame = requestAnimationFrame(() => {
      if (!disposed) layout(true);
    });

    document.fonts?.ready
      .then(() => {
        if (!disposed) layout(true);
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
      document.fonts?.removeEventListener?.("loadingdone", handleFonts);
    };
  }, [layout]);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div
      className={`rubber ${stretch ? "stretch" : ""} ${className}`.trim()}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      <div className="rubber-inner" ref={innerRef}>
        <div className="rubber-pill" ref={pillRef} aria-hidden />
        <div className="rubber-row base">
          {options.map((option, index) => {
            const isDisabled = disabled || option.disabled;
            return (
              <button
                key={option.value}
                ref={(element) => {
                  buttonRefs.current[index] = element;
                }}
                type="button"
                role="radio"
                aria-checked={value === option.value}
                className={`rubber-option ${isDisabled ? "is-disabled" : ""}`}
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled && option.value !== value) onChange(option.value);
                }}
              >
                {option.icon ? (
                  <span
                    className="rubber-icon"
                    ref={(element) => {
                      baseIconRefs.current[index] = element;
                    }}
                  >
                    {option.icon}
                  </span>
                ) : null}
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
        <div className="rubber-row top" ref={topRef} aria-hidden>
          {options.map((option, index) => (
            <div
              key={option.value}
              className={`rubber-option ${
                disabled || option.disabled ? "is-disabled" : ""
              }`}
            >
              {option.icon ? (
                <span
                  className="rubber-icon"
                  ref={(element) => {
                    topIconRefs.current[index] = element;
                  }}
                >
                  {option.icon}
                </span>
              ) : null}
              <span>{option.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
