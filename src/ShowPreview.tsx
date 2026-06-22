import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  Conflict,
  FiringRecord,
  FiringPoint,
  Segment,
  Zone,
  parseAngle,
  parseSafetyDistance,
} from "./conflictDetection";

const timeToMs = (time: string): number => {
  if (!time) return 0;
  const clean = time.trim();
  const match = clean.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)(?:\.(\d+))?$/);
  if (match) {
    const minutes = match[1] ? parseInt(match[1], 10) : 0;
    const seconds = parseFloat(match[2]);
    const msStr = match[3] || "0";
    return Math.round(
      minutes * 60000 +
        seconds * 1000 +
        parseInt(msStr.padEnd(3, "0").slice(0, 3), 10)
    );
  }
  const simpleMatch = clean.match(/^(\d+(?:\.\d+)?)s?$/);
  if (simpleMatch) {
    return Math.round(parseFloat(simpleMatch[1]) * 1000);
  }
  return 0;
};

const durationToMs = (duration: string): number => {
  if (!duration) return 0;
  const clean = duration.trim();
  const match = clean.match(/^(\d+(?:\.\d+)?)\s*s?$/i);
  if (match) {
    return Math.round(parseFloat(match[1]) * 1000);
  }
  const colonMatch = clean.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)(?:\.(\d+))?$/);
  if (colonMatch) {
    const minutes = colonMatch[1] ? parseInt(colonMatch[1], 10) : 0;
    const seconds = parseFloat(colonMatch[2]);
    const msStr = colonMatch[3] || "0";
    return Math.round(
      minutes * 60000 +
        seconds * 1000 +
        parseInt(msStr.padEnd(3, "0").slice(0, 3), 10)
    );
  }
  return 0;
};

const msToTime = (ms: number): string => {
  ms = Math.max(0, Math.round(ms));
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const milliseconds = ms % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}.${String(milliseconds).padStart(3, "0")}`;
};

const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4];

export interface ShowPreviewProps {
  segments: Segment[];
  records: FiringRecord[];
  firingPoints: FiringPoint[];
  zones: Zone[];
  conflicts: Conflict[];
  conflictRecordIds: string[];
  musicDuration?: string;
  onLocateRecord?: (recordId: string) => void;
  onTimeChange?: (ms: number) => void;
  onActiveRecordsChange?: (ids: string[]) => void;
  initialTimeMs?: number;
}

interface ActiveFirework {
  recordId: string;
  ignitionMs: number;
  durationMs: number;
  progress: number;
}

const ShowPreview: React.FC<ShowPreviewProps> = ({
  segments,
  records,
  firingPoints,
  zones,
  conflicts,
  conflictRecordIds,
  musicDuration = "",
  onLocateRecord,
  onTimeChange,
  onActiveRecordsChange,
  initialTimeMs = 0,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(initialTimeMs);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const activeRecordsListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onTimeChange) {
      onTimeChange(currentTimeMs);
    }
  }, [currentTimeMs, onTimeChange]);

  useEffect(() => {
    if (onActiveRecordsChange) {
      onActiveRecordsChange(activeRecordIds);
    }
  }, [activeRecordIds, onActiveRecordsChange]);

  const totalTimeMs = useMemo(() => {
    let max = 0;
    segments.forEach((s) => {
      const end = timeToMs(s.endTime);
      if (end > max) max = end;
    });
    records.forEach((r) => {
      const end = timeToMs(r.ignitionTime) + durationToMs(r.duration);
      if (end > max) max = end;
    });
    const mdMs = timeToMs(musicDuration);
    if (mdMs > max) max = mdMs;
    return Math.max(max, 30000);
  }, [segments, records, musicDuration]);

  const sortedSegments = useMemo(
    () => [...segments].sort((a, b) => timeToMs(a.startTime) - timeToMs(b.startTime)),
    [segments]
  );

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => timeToMs(a.ignitionTime) - timeToMs(b.ignitionTime)),
    [records]
  );

  const activeFireworks = useMemo<ActiveFirework[]>(() => {
    const active: ActiveFirework[] = [];
    sortedRecords.forEach((r) => {
      const ignitionMs = timeToMs(r.ignitionTime);
      const durMs = durationToMs(r.duration);
      const endMs = ignitionMs + durMs;
      if (currentTimeMs >= ignitionMs && currentTimeMs <= endMs && durMs > 0) {
        const progress = (currentTimeMs - ignitionMs) / durMs;
        active.push({
          recordId: r.id,
          ignitionMs,
          durationMs: durMs,
          progress,
        });
      }
    });
    return active;
  }, [sortedRecords, currentTimeMs]);

  const activeRecordIds = useMemo(
    () => activeFireworks.map((a) => a.recordId),
    [activeFireworks]
  );

  const currentSegment = useMemo(() => {
    for (const seg of sortedSegments) {
      const start = timeToMs(seg.startTime);
      const end = timeToMs(seg.endTime);
      if (currentTimeMs >= start && currentTimeMs <= end) {
        return seg;
      }
    }
    return null;
  }, [sortedSegments, currentTimeMs]);

  const nextConflict = useMemo(() => {
    const upcoming = conflicts.find((c) => {
      const earliest = c.involvedRecordIds
        .map((id) => records.find((r) => r.id === id))
        .filter(Boolean)
        .map((r) => timeToMs((r as FiringRecord).ignitionTime));
      if (earliest.length === 0) return false;
      return Math.min(...earliest) > currentTimeMs;
    });
    return upcoming || null;
  }, [conflicts, records, currentTimeMs]);

  const tick = useCallback(
    (timestamp: number) => {
      if (!lastTickRef.current) {
        lastTickRef.current = timestamp;
      }
      const delta = (timestamp - lastTickRef.current) * playbackSpeed;
      lastTickRef.current = timestamp;

      setCurrentTimeMs((prev) => {
        const next = prev + delta;
        if (next >= totalTimeMs) {
          setIsPlaying(false);
          return totalTimeMs;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(tick);
    },
    [playbackSpeed, totalTimeMs]
  );

  useEffect(() => {
    if (isPlaying) {
      lastTickRef.current = 0;
      animFrameRef.current = requestAnimationFrame(tick);
      return () => {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
        }
      };
    }
  }, [isPlaying, tick]);

  useEffect(() => {
    if (activeRecordIds.length > 0 && activeRecordsListRef.current) {
      const firstActive = activeRecordsListRef.current.querySelector(
        `[data-record-id="${activeRecordIds[0]}"]`
      ) as HTMLElement | null;
      if (firstActive) {
        firstActive.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [activeRecordIds]);

  const handlePlayPause = () => {
    if (currentTimeMs >= totalTimeMs) {
      setCurrentTimeMs(0);
    }
    setIsPlaying((p) => !p);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTimeMs(0);
  };

  const handleSeek = (ms: number) => {
    setCurrentTimeMs(Math.max(0, Math.min(totalTimeMs, ms)));
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    handleSeek(ratio * totalTimeMs);
  };

  const handleJumpToSegment = (segId: string) => {
    const seg = segments.find((s) => s.id === segId);
    if (seg) {
      handleSeek(timeToMs(seg.startTime));
    }
  };

  const handleJumpToNextConflict = () => {
    if (nextConflict) {
      const times = nextConflict.involvedRecordIds
        .map((id) => records.find((r) => r.id === id))
        .filter(Boolean)
        .map((r) => timeToMs((r as FiringRecord).ignitionTime));
      if (times.length > 0) {
        handleSeek(Math.min(...times) - 1000);
        setIsPlaying(false);
      }
    }
  };

  const getPointById = (id?: string) => firingPoints.find((p) => p.id === id) || null;
  const getZoneById = (id: string) => zones.find((z) => z.id === id);
  const getRecordById = (id: string) => records.find((r) => r.id === id);
  const getSegmentById = (id: string) => segments.find((s) => s.id === id);

  return (
    <div className="show-preview">
      <div className="preview-header">
        <div className="preview-title">
          <p>整场预览</p>
          <h2>节目预演播放器</h2>
        </div>
        <div className="preview-header-controls">
          {currentSegment && (
            <span
              className="current-segment-tag"
              style={{
                background: `${currentSegment.themeColor}15`,
                color: currentSegment.themeColor,
                borderColor: `${currentSegment.themeColor}40`,
              }}
            >
              当前段落：{currentSegment.name}
            </span>
          )}
          {nextConflict && (
            <button className="jump-conflict-btn" onClick={handleJumpToNextConflict}>
              ⚠ 跳到下一冲突
            </button>
          )}
        </div>
      </div>

      <div className="preview-controls-bar">
        <div className="playback-controls">
          <button className="control-btn reset-btn" onClick={handleReset} title="重置到开头">
            ⏮
          </button>
          <button className="control-btn play-btn primary" onClick={handlePlayPause}>
            {isPlaying ? "⏸ 暂停" : "▶ 播放"}
          </button>
          <div className="speed-selector">
            {PLAYBACK_SPEEDS.map((s) => (
              <button
                key={s}
                className={`speed-btn ${playbackSpeed === s ? "active" : ""}`}
                onClick={() => setPlaybackSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <div className="time-display">
          <span className="current-time">{msToTime(currentTimeMs)}</span>
          <span className="time-sep">/</span>
          <span className="total-time">{msToTime(totalTimeMs)}</span>
        </div>
      </div>

      <div
        className="progress-track"
        onClick={handleProgressClick}
        title="点击跳转"
      >
        <div
          className="progress-fill"
          style={{ width: `${(currentTimeMs / totalTimeMs) * 100}%` }}
        />
        <div
          className="progress-handle"
          style={{ left: `${(currentTimeMs / totalTimeMs) * 100}%` }}
        />
        {sortedSegments.map((seg) => {
          const start = timeToMs(seg.startTime);
          const end = timeToMs(seg.endTime);
          return (
            <div
              key={seg.id}
              className="progress-segment-marker"
              style={{
                left: `${(start / totalTimeMs) * 100}%`,
                width: `${((end - start) / totalTimeMs) * 100}%`,
                background: `${seg.themeColor}20`,
                borderLeftColor: seg.themeColor,
              }}
              title={`${seg.name} (${seg.startTime} - ${seg.endTime})`}
              onClick={(e) => {
                e.stopPropagation();
                handleJumpToSegment(seg.id);
              }}
            />
          );
        })}
        {sortedRecords.map((r) => (
          <div
            key={r.id}
            className={`progress-record-tick ${
              conflictRecordIds.includes(r.id) ? "conflict" : ""
            }`}
            style={{ left: `${(timeToMs(r.ignitionTime) / totalTimeMs) * 100}%` }}
            title={`${r.model} @ ${r.ignitionTime}`}
          />
        ))}
      </div>

      <div className="preview-body">
        <div className="preview-plan-section">
          <div className="preview-section-header">
            <h3>燃放点位动态</h3>
            <span className="active-count">
              活跃 {activeFireworks.length} / 共 {records.length}
            </span>
          </div>
          <div className="preview-plan-canvas">
            <svg viewBox="0 0 500 480" className="preview-plan-svg">
              <defs>
                <pattern id="preview-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
                </pattern>
                <radialGradient id="firework-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9" />
                  <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="safety-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#dc2626" stopOpacity="0.08" />
                  <stop offset="70%" stopColor="#dc2626" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#preview-grid)" />

              {zones.map((zone) => (
                <g key={zone.id}>
                  <rect
                    x={zone.x}
                    y={zone.y}
                    width={zone.width}
                    height={zone.height}
                    fill={zone.color}
                    fillOpacity="0.1"
                    stroke={zone.color}
                    strokeWidth="1.5"
                    strokeDasharray="6 3"
                    rx="6"
                  />
                  <text
                    x={zone.x + zone.width / 2}
                    y={zone.y + 20}
                    textAnchor="middle"
                    fill={zone.color}
                    fontSize="12"
                    fontWeight="700"
                    style={{ userSelect: "none" }}
                  >
                    {zone.name}
                  </text>
                </g>
              ))}

              {firingPoints.map((point) => {
                const zone = getZoneById(point.zoneId);
                const hasActive = activeFireworks.some((af) => {
                  const rec = getRecordById(af.recordId);
                  return rec?.firingPointId === point.id;
                });
                const safetyRadius = point.safetyDistance * 0.8;

                return (
                  <g key={point.id}>
                    {hasActive && (
                      <>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={safetyRadius}
                          fill="url(#safety-glow)"
                          stroke="#dc2626"
                          strokeWidth="1.5"
                          strokeDasharray="4 3"
                          style={{ pointerEvents: "none" }}
                        />
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={safetyRadius}
                          fill="none"
                          stroke="#dc2626"
                          strokeWidth="1"
                          strokeOpacity="0.5"
                          style={{ pointerEvents: "none" }}
                        >
                          <animate
                            attributeName="r"
                            values={`${safetyRadius * 0.6};${safetyRadius * 1.1};${safetyRadius * 0.6}`}
                            dur="1.5s"
                            repeatCount="indefinite"
                          />
                          <animate
                            attributeName="stroke-opacity"
                            values="0.7;0.2;0.7"
                            dur="1.5s"
                            repeatCount="indefinite"
                          />
                        </circle>
                      </>
                    )}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={hasActive ? 16 : 12}
                      fill={hasActive ? "#f59e0b" : zone?.color || "#64748b"}
                      stroke={hasActive ? "#fbbf24" : "#ffffff"}
                      strokeWidth="2"
                      style={{
                        filter: hasActive
                          ? "drop-shadow(0 0 12px rgba(245, 158, 11, 0.9))"
                          : "drop-shadow(0 1px 3px rgba(0,0,0,0.15))",
                        transition: "all 0.25s ease",
                      }}
                    />
                    <text
                      x={point.x}
                      y={point.y + 3}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={hasActive ? "10" : "9"}
                      fontWeight="700"
                      style={{ userSelect: "none", pointerEvents: "none" }}
                    >
                      {point.name}
                    </text>
                  </g>
                );
              })}

              {activeFireworks.map((af) => {
                const rec = getRecordById(af.recordId);
                if (!rec) return null;
                const point = getPointById(rec.firingPointId);
                if (!point) return null;
                const zone = getZoneById(point.zoneId);
                const angle = parseAngle(rec.angle);
                const safetyDist = parseSafetyDistance(rec.safetyDistance) || point.safetyDistance;
                const baseColor = conflictRecordIds.includes(rec.id) ? "#dc2626" : zone?.color || "#1d4ed8";
                const trailLength = 30 + safetyDist * 0.5;
                const angleRad = ((angle - 90) * Math.PI) / 180;
                const endX = point.x + Math.cos(angleRad) * trailLength;
                const endY = point.y + Math.sin(angleRad) * trailLength;

                const burstX = point.x + Math.cos(angleRad) * trailLength * (0.6 + af.progress * 0.4);
                const burstY = point.y + Math.sin(angleRad) * trailLength * (0.6 + af.progress * 0.4);
                const burstR = 8 + af.progress * 20;

                return (
                  <g key={`fw-${af.recordId}`} style={{ pointerEvents: "none" }}>
                    <line
                      x1={point.x}
                      y1={point.y}
                      x2={endX}
                      y2={endY}
                      stroke={baseColor}
                      strokeWidth="3"
                      strokeOpacity="0.3"
                      strokeLinecap="round"
                    />
                    <line
                      x1={point.x}
                      y1={point.y}
                      x2={burstX}
                      y2={burstY}
                      stroke="#fbbf24"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      style={{ filter: "drop-shadow(0 0 6px rgba(251, 191, 36, 0.9))" }}
                    />
                    <circle cx={burstX} cy={burstY} r={burstR * 0.5} fill="url(#firework-glow)">
                      <animate
                        attributeName="r"
                        values={`${burstR * 0.3};${burstR};${burstR * 0.3}`}
                        dur="0.8s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                      const pAngle = (i / 8) * Math.PI * 2;
                      const pR = burstR * (0.6 + af.progress * 0.4);
                      const px = burstX + Math.cos(pAngle) * pR;
                      const py = burstY + Math.sin(pAngle) * pR;
                      return (
                        <circle
                          key={i}
                          cx={px}
                          cy={py}
                          r={2 + af.progress * 1.5}
                          fill={baseColor}
                          opacity={1 - af.progress * 0.5}
                        />
                      );
                    })}
                    <text
                      x={point.x}
                      y={point.y - 28}
                      textAnchor="middle"
                      fill={baseColor}
                      fontSize="10"
                      fontWeight="700"
                      style={{ userSelect: "none" }}
                    >
                      {angle}°
                    </text>
                    <text
                      x={point.x}
                      y={point.y - 16}
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="9"
                      style={{ userSelect: "none" }}
                    >
                      {safetyDist}m · {rec.duration}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="preview-nav-section">
            <div className="nav-section-title">段落跳转</div>
            <div className="segment-jump-list">
              {sortedSegments.map((seg) => {
                const isCurrent = currentSegment?.id === seg.id;
                const startMs = timeToMs(seg.startTime);
                const isPassed = currentTimeMs > startMs;
                return (
                  <button
                    key={seg.id}
                    className={`segment-jump-btn ${isCurrent ? "current" : ""} ${
                      isPassed ? "passed" : ""
                    }`}
                    style={{
                      borderLeftColor: seg.themeColor,
                      background: isCurrent ? `${seg.themeColor}12` : undefined,
                    }}
                    onClick={() => handleJumpToSegment(seg.id)}
                  >
                    <span className="seg-jump-name">{seg.name}</span>
                    <span className="seg-jump-time">{seg.startTime}</span>
                  </button>
                );
              })}
            </div>

            {conflicts.length > 0 && (
              <>
                <div className="nav-section-title" style={{ marginTop: 16 }}>
                  冲突节点
                </div>
                <div className="conflict-jump-list">
                  {conflicts.slice(0, 8).map((c, idx) => {
                    const times = c.involvedRecordIds
                      .map((id) => records.find((r) => r.id === id))
                      .filter(Boolean)
                      .map((r) => timeToMs((r as FiringRecord).ignitionTime));
                    const minTime = times.length > 0 ? Math.min(...times) : 0;
                    const severityColor =
                      c.severity === "critical"
                        ? "#dc2626"
                        : c.severity === "warning"
                        ? "#f59e0b"
                        : "#1d4ed8";
                    return (
                      <button
                        key={c.id}
                        className="conflict-jump-btn"
                        style={{ borderLeftColor: severityColor }}
                        onClick={() => {
                          handleSeek(minTime - 1000);
                          setIsPlaying(false);
                        }}
                      >
                        <span className="conflict-jump-label">
                          {idx + 1}. {c.title}
                        </span>
                        <span className="conflict-jump-time">{msToTime(minTime)}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="preview-records-section">
          <div className="preview-section-header">
            <h3>点火记录同步</h3>
            <span className="active-count">
              活跃 {activeRecordIds.length}
            </span>
          </div>
          <div className="preview-records-list" ref={activeRecordsListRef}>
            {sortedRecords.map((r, idx) => {
              const isActive = activeRecordIds.includes(r.id);
              const seg = getSegmentById(r.segmentId);
              const point = r.firingPointId ? getPointById(r.firingPointId) : null;
              const hasConflict = conflictRecordIds.includes(r.id);
              const ignitionMs = timeToMs(r.ignitionTime);
              const durMs = durationToMs(r.duration);
              const isPast = currentTimeMs > ignitionMs + durMs;
              const isUpcoming = currentTimeMs < ignitionMs;

              return (
                <div
                  key={r.id}
                  data-record-id={r.id}
                  className={`preview-record-item ${isActive ? "active" : ""} ${
                    isPast ? "past" : ""
                  } ${isUpcoming ? "upcoming" : ""} ${
                    selectedRecordId === r.id ? "selected" : ""
                  }`}
                  style={{
                    borderColor: isActive
                      ? seg?.themeColor
                      : hasConflict
                      ? "#dc2626"
                      : undefined,
                    boxShadow: isActive
                      ? `0 0 0 2px ${seg?.themeColor}40, 0 4px 12px ${seg?.themeColor}20`
                      : undefined,
                  }}
                  onClick={() => {
                    setSelectedRecordId(r.id);
                    handleSeek(ignitionMs);
                    setIsPlaying(false);
                    if (onLocateRecord) onLocateRecord(r.id);
                  }}
                >
                  <div
                    className="preview-record-index"
                    style={{
                      background: isActive
                        ? seg?.themeColor
                        : hasConflict
                        ? "#dc2626"
                        : isPast
                        ? "#94a3b8"
                        : seg?.themeColor || "#64748b",
                    }}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <div className="preview-record-content">
                    <div className="preview-record-header">
                      <strong className="preview-record-model">{r.model}</strong>
                      {seg && (
                        <span
                          className="preview-record-tag"
                          style={{
                            background: `${seg.themeColor}15`,
                            color: seg.themeColor,
                            borderColor: `${seg.themeColor}40`,
                          }}
                        >
                          {seg.type}
                        </span>
                      )}
                      {point && (
                        <span className="preview-record-tag point-tag">点位 {point.name}</span>
                      )}
                      {hasConflict && (
                        <span className="preview-record-tag conflict-tag">⚠ 冲突</span>
                      )}
                      {isActive && (
                        <span className="preview-record-tag active-tag">▶ 燃放中</span>
                      )}
                    </div>
                    <div className="preview-record-meta">
                      <span>点火 {r.ignitionTime}</span>
                      <span>持续 {r.duration || "-"}</span>
                      <span>{r.caliber}</span>
                      <span>{r.angle}</span>
                      <span>安全 {r.safetyDistance}</span>
                    </div>
                    {isActive && (
                      <div className="preview-record-progress">
                        <div
                          className="preview-record-progress-fill"
                          style={{
                            width: `${
                              activeFireworks.find((af) => af.recordId === r.id)?.progress
                                ? (activeFireworks.find((af) => af.recordId === r.id)!.progress * 100).toFixed(0) + "%"
                                : "0%"
                            }`,
                            background: seg?.themeColor,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShowPreview;
