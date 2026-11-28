import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

import { useI18n } from "../lib/i18n";
import {
  baseName,
  formatBytes,
  formatEta,
  formatSpeed,
  hostOf,
  humanizeError,
  parseWarn,
} from "../lib/format";
import type { MediaKind, QueueItem } from "../lib/types";
import { SpeedChart } from "./SpeedChart";
import { Meter } from "./Meter";
import {
  IconDownload,
  IconFilm,
  IconFolder,
  IconMusic,
  IconTrash,
  IconX,
} from "./Icons";
import { RubberSegmented, type RubberOption } from "./RubberSegmented";
import { LoadingSuccessButton } from "./LoadingSuccessButton";

type Notify = (message: string, kind?: "info" | "error" | "success") => void;

interface DownloadsProps {
  queue: QueueItem[];
  onEnqueue: (urls: string[], kind: MediaKind) => Promise<boolean>;
  onCancel: (id: number) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
  onClearFinished: () => Promise<void>;
  notify: Notify;
}

const kindLabel: Record<MediaKind, string> = { mp4: "MP4", webm: "WEBM", mp3: "MP3" };

function isSoundCloud(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "soundcloud.com" ||
      host.endsWith(".soundcloud.com") ||
      host === "snd.sc" ||
      host === "on.soundcloud.com"
    );
  } catch {
    return false;
  }
}

export function Downloads({
  queue,
  onEnqueue,
  onCancel,
  onRemove,
  onClearFinished,
  notify,
}: DownloadsProps) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<MediaKind>("mp4");
  const [samples, setSamples] = useState<Record<number, number[]>>({});
  const [queueExpanded, setQueueExpanded] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const active = queue.filter(
    (item) => item.status === "queued" || item.status === "downloading" || item.status === "processing",
  ).length;
  const finished = queue.length - active;

  const urls = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const soundcloudOnly = urls.length > 0 && urls.every(isSoundCloud);
  const previousSoundcloud = useRef(false);

  useEffect(() => {
    if (soundcloudOnly && !previousSoundcloud.current) {
      setKind("mp3");
    } else if (!soundcloudOnly && previousSoundcloud.current) {
      setKind("mp4");
    }
    previousSoundcloud.current = soundcloudOnly;
  }, [soundcloudOnly]);

  useEffect(() => {
    setSamples((previous) => {
      const next: Record<number, number[]> = {};
      let changed = false;

      for (const item of queue) {
        const live = item.status === "downloading" || item.status === "processing";
        if (!live) continue;
        if (item.speed && item.speed > 0) {
          next[item.id] = [...(previous[item.id] ?? []), item.speed].slice(-120);
          changed = true;
        } else if (previous[item.id]) {
          next[item.id] = previous[item.id];
        }
      }

      return changed ? next : previous;
    });
  }, [queue]);

  async function add(): Promise<boolean> {
    if (urls.length === 0) {
      inputRef.current?.focus();
      return false;
    }
    if (adding) return false;
    setAdding(true);
    try {
      const added = await onEnqueue(urls, kind);
      if (added) setText("");
      return added;
    } finally {
      setAdding(false);
    }
  }

  async function openFolder(item: QueueItem) {
    try {
      if (item.outputPath) {
        await revealItemInDir(item.outputPath);
      } else {
        notify(t("downloads.openFolder"), "error");
      }
    } catch (error) {
      notify(String(error), "error");
    }
  }

  const formatOptions: RubberOption<MediaKind>[] = [
    {
      value: "mp4",
      label: t("downloads.mp4"),
      icon: <IconFilm size={16} />,
      disabled: soundcloudOnly,
    },
    {
      value: "webm",
      label: t("downloads.webm"),
      icon: <IconFilm size={16} />,
      disabled: soundcloudOnly,
    },
    {
      value: "mp3",
      label: t("downloads.mp3"),
      icon: <IconMusic size={16} />,
    },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t("downloads.title")}</h1>
          <p>{t("downloads.subtitle")}</p>
        </div>
        {active > 0 && (
          <div className="page-meta">
            <span>{t("downloads.activeCount", { count: active })}</span>
          </div>
        )}
      </header>

      <section className="card input-card">
        <textarea
          ref={inputRef}
          className="url-input"
          rows={3}
          spellCheck={false}
          placeholder={t("downloads.placeholder")}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void add();
            }
          }}
        />
        <div className="download-row">
          <RubberSegmented<MediaKind>
            className="download-formats"
            options={formatOptions}
            value={kind}
            onChange={setKind}
            ariaLabel={t("downloads.format")}
            disabled={adding}
            stretch
          />
          <LoadingSuccessButton
            label={t("downloads.download")}
            successLabel={t("status.done")}
            icon={<IconDownload size={16} />}
            disabled={adding}
            onAction={add}
          />
        </div>
        {soundcloudOnly && (
          <p className="download-note muted small">{t("downloads.soundcloudHint")}</p>
        )}
      </section>

      <section className="queue">
        <div className="queue-header">
          <h2>
            {t("downloads.queue")}
            <span className="count">{queue.length}</span>
          </h2>
          <div className="queue-header-actions">
            {queue.length > 1 && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setQueueExpanded((current) => !current)}
              >
                {queueExpanded ? t("downloads.collapse") : t("downloads.showAll")}
              </button>
            )}
            {finished > 0 && (
              <button type="button" className="btn btn-ghost" onClick={() => void onClearFinished()}>
                <IconTrash size={14} />
                {t("downloads.clear")}
              </button>
            )}
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <IconDownload size={17} />
            </div>
            <div className="empty-text">
              <strong>{t("downloads.empty")}</strong>
              <span>{t("downloads.emptyHint")}</span>
            </div>
          </div>
        ) : (
          <QueueStack
            queue={queue}
            samples={samples}
            expanded={queueExpanded}
            onToggle={() => setQueueExpanded((current) => !current)}
            onCancel={onCancel}
            onRemove={onRemove}
            onOpenFolder={openFolder}
          />
        )}
      </section>
    </div>
  );
}

const STACK_PEEK = 10;
const STACK_VISIBLE_BEHIND = 2;
const STACK_GAP = 8;
const STACK_FALLBACK_HEIGHT = 78;

function QueueStack({
  queue,
  samples,
  expanded,
  onToggle,
  onCancel,
  onRemove,
  onOpenFolder,
}: {
  queue: QueueItem[];
  samples: Record<number, number[]>;
  expanded: boolean;
  onToggle: () => void;
  onCancel: (id: number) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
  onOpenFolder: (item: QueueItem) => Promise<void>;
}) {
  const [heights, setHeights] = useState<Record<number, number>>({});
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const itemRefs = useRef(new Map<number, HTMLLIElement>());

  const statusRank = (item: QueueItem) =>
    item.status === "downloading" || item.status === "processing"
      ? 0
      : item.status === "queued"
        ? 1
        : 2;

  const ordered = [...queue].sort((left, right) => {
    const rank = statusRank(left) - statusRank(right);
    if (rank !== 0) return rank;
    return right.createdAt - left.createdAt;
  });

  const ids = queue.map((item) => item.id).join(",");
  const expandedNow = (expanded || hovered || focused) && ordered.length > 1;
  const heightOf = (id: number) => heights[id] ?? STACK_FALLBACK_HEIGHT;
  const frontHeight = heightOf(ordered[0].id);

  const offsets: number[] = [];
  let running = 0;
  for (const item of ordered) {
    offsets.push(running);
    running += heightOf(item.id) + STACK_GAP;
  }

  const stackHeight = expandedNow
    ? Math.max(running - STACK_GAP, 0)
    : frontHeight + Math.min(ordered.length - 1, STACK_VISIBLE_BEHIND) * STACK_PEEK;

  useLayoutEffect(() => {
    const measure = () => {
      setHeights((previous) => {
        let next = previous;
        itemRefs.current.forEach((element, id) => {
          const height = Math.round(element.offsetHeight);
          if (height && previous[id] !== height) {
            if (next === previous) next = { ...previous };
            next[id] = height;
          }
        });
        return next;
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    itemRefs.current.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  return (
    <ol
      className={`queue-stack ${expandedNow ? "expanded" : ""}`}
      ref={listRef}
      style={{ height: stackHeight }}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setHovered(false);
      }}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
    >
      {ordered.map((item, index) => {
        const depth = index;
        const hiddenBehind = !expandedNow && depth > STACK_VISIBLE_BEHIND;
        const scale = expandedNow ? 1 : 1 - depth * 0.05;
        const y = expandedNow
          ? offsets[index]
          : frontHeight + depth * STACK_PEEK - heightOf(item.id) * scale;

        return (
          <li
            key={item.id}
            ref={(element) => {
              if (element) itemRefs.current.set(item.id, element);
              else itemRefs.current.delete(item.id);
            }}
            className={`queue-stack-item ${depth === 0 ? "front" : ""} ${
              hiddenBehind ? "hidden-behind" : ""
            }`}
            style={{
              transform: `translateY(${y}px) scale(${scale})`,
              opacity: hiddenBehind ? 0 : 1,
              zIndex: ordered.length - depth,
              pointerEvents: hiddenBehind ? "none" : undefined,
            }}
          >
            <div
              className="queue-stack-body"
              onClick={(event) => {
                if (expandedNow || depth !== 0) return;
                if ((event.target as Element).closest("button")) return;
                onToggle();
              }}
            >
              <QueueCard
                item={item}
                samples={samples[item.id] ?? []}
                onCancel={onCancel}
                onRemove={onRemove}
                onOpenFolder={onOpenFolder}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function QueueCard({
  item,
  samples,
  onCancel,
  onRemove,
  onOpenFolder,
}: {
  item: QueueItem;
  samples: number[];
  onCancel: (id: number) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
  onOpenFolder: (item: QueueItem) => Promise<void>;
}) {
  const { t } = useI18n();
  const warn = parseWarn(t, item.warn);
  const running = item.status === "downloading" || item.status === "processing";
  const progress = Math.max(0, Math.min(100, item.percent || 0));
  const speed = formatSpeed(item.speed);
  const eta = formatEta(item.eta);
  const dotClass =
    item.status === "done"
      ? "done"
      : item.status === "error"
        ? "error"
        : running
          ? "active"
          : "";

  return (
    <div className={`queue-item status-${item.status}`}>
      <div className="kind-badge">
        {item.kind === "mp3" ? <IconMusic size={17} /> : <IconFilm size={17} />}
      </div>

      <div className="queue-main">
        <div className="queue-title-row">
          <span className="queue-title">{item.title || hostOf(item.url)}</span>
          {item.playlistIndex != null && item.nEntries != null && item.nEntries > 1 && (
            <span className="playlist-chip">
              {t("downloads.playlist", {
                index: item.playlistIndex,
                total: item.nEntries,
              })}
            </span>
          )}
        </div>

        <div className="queue-sub">
          <span className="queue-kind">{kindLabel[item.kind]}</span>
          <span className="status-label">
            <span className={`status-dot ${dotClass}`} />
            {t(`status.${item.status}`)}
          </span>
          <span className="queue-url" title={item.url}>
            {item.status === "done" && item.outputPath
              ? baseName(item.outputPath)
              : hostOf(item.url)}
          </span>
          {running && (
            <>
              <span className="queue-metric">{Math.round(progress)}%</span>
              {speed && <span className="queue-metric">{speed}</span>}
              {eta && (
                <span className="queue-metric">{t("downloads.eta", { time: eta })}</span>
              )}
              {item.total != null && (
                <span className="queue-metric">
                  {formatBytes(item.downloaded)} / {formatBytes(item.total)}
                </span>
              )}
            </>
          )}
        </div>

        {running && (
          <>
            <Meter value={progress} processing={item.status === "processing"} />
            <SpeedChart samples={samples} />
          </>
        )}

        {item.status === "error" && item.error && (
          <div className="queue-error">{humanizeError(t, item.error)}</div>
        )}

        {warn && (
          <div className="queue-warn">
            <strong>{warn.title}</strong>
            {warn.reasons.length > 0 && <span>{warn.reasons.join(" · ")}</span>}
          </div>
        )}
      </div>

      <div className="queue-actions">
        {item.status === "done" && item.outputPath && (
          <button
            type="button"
            className="icon-btn"
            title={t("downloads.openFolder")}
            onClick={() => void onOpenFolder(item)}
          >
            <IconFolder size={15} />
          </button>
        )}
        {(running || item.status === "queued") && (
          <button
            type="button"
            className="icon-btn danger"
            title={t("downloads.cancel")}
            onClick={() => void onCancel(item.id)}
          >
            <IconX size={15} />
          </button>
        )}
        {!running && item.status !== "queued" && (
          <button
            type="button"
            className="icon-btn"
            title={t("downloads.remove")}
            onClick={() => void onRemove(item.id)}
          >
            <IconTrash size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
