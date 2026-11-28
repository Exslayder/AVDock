import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";

import { useI18n } from "../lib/i18n";
import type { Page } from "../lib/types";
import { IconDownload, IconSettings, IconSliders } from "./Icons";

interface TopNavProps {
  page: Page;
  onNavigate: (page: Page) => void;
  activeCount: number;
}

// One spring per pill edge: the edge facing the move is stiff, the tail is
// soft, so the pill stretches toward the new tab and then pulls itself in.
const LEAD = { stiffness: 620, damping: 40 };
const TRAIL = { stiffness: 170, damping: 19 };

// The menu lingers a moment after the pointer leaves, so brushing past the
// top edge does not snap it shut.
const CLOSE_DELAY = 480;

export function TopNav({ page, onNavigate, activeCount }: TopNavProps) {
  const { t } = useI18n();

  const items: Array<{ id: Page; label: string; icon: ReactNode }> = [
    { id: "downloads", label: t("nav.downloads"), icon: <IconDownload size={16} /> },
    { id: "converter", label: t("nav.converter"), icon: <IconSliders size={16} /> },
    { id: "settings", label: t("nav.settings"), icon: <IconSettings size={16} /> },
  ];

  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<Page, HTMLButtonElement>());

  // Hover opens the menu; a click or Enter pins it open for touch/keyboard.
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setHovered(false);
      setPinned(false);
    }, CLOSE_DELAY);
  };

  useEffect(() => cancelClose, []);

  // Width morphs between the compact label and the full row of tabs.
  const width = useMotionValue(0);
  const widthTarget = useRef(0);
  const sized = useRef(false);

  // The active-tab pill still uses two edges, so it stretches on the way.
  const left = useMotionValue(0);
  const right = useMotionValue(0);
  const pillWidth = useTransform([left, right], ([a, b]: number[]) => Math.max(0, b - a));
  const pillReady = useRef(false);
  const last = useRef({ left: 0, right: 0 });
  const previousPage = useRef<Page>(page);

  const measurePill = (animateMove: boolean) => {
    const el = buttons.current.get(page);
    if (!el) return;

    const nextLeft = el.offsetLeft;
    const nextRight = nextLeft + el.offsetWidth;
    const changed =
      Math.abs(nextLeft - last.current.left) > 0.4 ||
      Math.abs(nextRight - last.current.right) > 0.4;
    const pageChanged = previousPage.current !== page;

    if (!pillReady.current) {
      left.set(nextLeft);
      right.set(nextRight);
    } else if (changed) {
      if (animateMove && pageChanged) {
        const forward =
          (nextLeft + nextRight) / 2 >= (last.current.left + last.current.right) / 2;
        animate(left, nextLeft, {
          type: "spring",
          ...(forward ? TRAIL : LEAD),
          velocity: left.getVelocity(),
        });
        animate(right, nextRight, {
          type: "spring",
          ...(forward ? LEAD : TRAIL),
          velocity: right.getVelocity(),
        });
      } else {
        left.set(nextLeft);
        right.set(nextRight);
      }
    }

    last.current = { left: nextLeft, right: nextRight };
    previousPage.current = page;
    pillReady.current = true;
  };

  const measureWidth = () => {
    const content = open ? tabsRef.current?.offsetWidth : menuRef.current?.offsetWidth;
    if (!content) return;

    const next = Math.ceil(content + 8);
    if (!sized.current) {
      width.set(next);
      widthTarget.current = next;
      sized.current = true;
      return;
    }
    if (Math.abs(next - widthTarget.current) > 0.5) {
      widthTarget.current = next;
      animate(width, next, {
        type: "spring",
        stiffness: open ? 330 : 430,
        damping: open ? 27 : 33,
        velocity: width.getVelocity(),
      });
    }
  };

  const onResizeRef = useRef<() => void>(() => undefined);
  onResizeRef.current = () => {
    measurePill(false);
    measureWidth();
  };

  // Every render: page and language changes resize the tabs.
  useLayoutEffect(() => {
    measurePill(true);
    measureWidth();
  });

  // Inner label or font resizes: snap instead of sliding, without observing
  // the outer root element whose width is animated on every spring frame.
  useEffect(() => {
    const menu = menuRef.current;
    const tabs = tabsRef.current;
    if (!menu && !tabs) return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => onResizeRef.current());
    });
    if (menu) observer.observe(menu);
    if (tabs) observer.observe(tabs);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  // A pinned menu closes on Escape or on a click anywhere outside.
  useEffect(() => {
    if (!pinned) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setPinned(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinned(false);
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [pinned]);

  const select = (id: Page) => {
    onNavigate(id);
    if (!hovered) setPinned(false);
  };

  return (
    <motion.div
      ref={rootRef}
      className={`topnav ${open ? "open" : ""}`}
      style={{ width }}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          cancelClose();
          setHovered(true);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") scheduleClose();
      }}
    >
      <button
        ref={menuRef}
        type="button"
        className="topnav-menu"
        aria-expanded={open}
        aria-label={t("nav.menu")}
        onClick={() => {
          cancelClose();
          setPinned((value) => !value);
        }}
      >
        <span>{t("nav.menu")}</span>
        <svg
          className="topnav-chevron"
          viewBox="0 0 12 12"
          width="11"
          height="11"
          aria-hidden="true"
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div
        className="topnav-tabs"
        ref={tabsRef}
        role="tablist"
        aria-label={t("nav.sections")}
        aria-hidden={!open}
      >
        <motion.span
          className="topnav-pill"
          style={{ x: left, width: pillWidth }}
          aria-hidden="true"
        />
        {items.map((item) => {
          const active = page === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={open ? 0 : -1}
              className={active ? "active" : ""}
              ref={(element) => {
                if (element) buttons.current.set(item.id, element);
                else buttons.current.delete(item.id);
              }}
              onClick={() => select(item.id)}
            >
              <span className="topnav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === "downloads" && activeCount > 0 && (
                <span className="topnav-badge mono">{activeCount}</span>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
