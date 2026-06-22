import { useState, useRef, useCallback, useMemo, useEffect } from "react";

interface Segment {
  id: string;
  name: string;
  type: "Intro" | "Chorus" | "Bridge" | "Finale" | "Other";
  startTime: string;
  endTime: string;
  themeColor: string;
  notes: string;
}

interface FiringRecord {
  id: string;
  segmentId: string;
  model: string;
  caliber: string;
  angle: string;
  ignitionTime: string;
  duration: string;
  safetyDistance: string;
  remark: string;
}

interface MusicMarker {
  id: string;
  time: string;
  label: string;
  type: "beat" | "segment-entry";
}

interface TimelineEditorProps {
  segments: Segment[];
  records: FiringRecord[];
  selectedSegmentId: string | null;
  onSelectSegment: (id: string) => void;
  onUpdateRecord: (updated: FiringRecord) => void;
  onSelectRecord: (record: FiringRecord) => void;
  highlightedRecordIds?: string[];
  conflictRecordIds?: string[];
  musicDuration?: string;
  musicMarkers?: MusicMarker[];
  onSnapToMarker?: (recordId: string, markerId: string, originalTime: string, snappedTime: string) => void;
  currentTimeMs?: number;
  activeRecordIds?: string[];
}

const timeToMs = (time: string): number => {
  if (!time) return 0;
  const clean = time.trim();
  const match = clean.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)(?:\.(\d+))?$/);
  if (match) {
    const minutes = match[1] ? parseInt(match[1], 10) : 0;
    const seconds = parseFloat(match[2]);
    const msStr = match[3] || "0";
    return Math.round(minutes * 60000 + seconds * 1000 + parseInt(msStr.padEnd(3, "0").slice(0, 3), 10));
  }
  const simpleMatch = clean.match(/^(\d+(?:\.\d+)?)s?$/);
  if (simpleMatch) {
    return Math.round(parseFloat(simpleMatch[1]) * 1000);
  }
  return 0;
};

const msToTime = (ms: number): string => {
  ms = Math.max(0, Math.round(ms));
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const milliseconds = ms % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
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
    return Math.round(minutes * 60000 + seconds * 1000 + parseInt(msStr.padEnd(3, "0").slice(0, 3), 10));
  }
  return 0;
};

const msToDuration = (ms: number): string => {
  ms = Math.max(0, Math.round(ms));
  return `${(ms / 1000).toFixed(1)}s`;
};

const MIN_PX_PER_SEC = 20;
const MAX_PX_PER_SEC = 400;
const DEFAULT_PX_PER_SEC = 80;
const ROW_HEIGHT = 64;
const ROW_GAP = 8;
const SEG_LABEL_WIDTH = 180;
const TIMELINE_HEADER_HEIGHT = 44;
const NODE_MIN_WIDTH = 28;
const SNAP_THRESHOLD_PX = 12;

const TimelineEditor: React.FC<TimelineEditorProps> = ({
  segments,
  records,
  selectedSegmentId,
  onSelectSegment,
  onUpdateRecord,
  onSelectRecord,
  highlightedRecordIds = [],
  conflictRecordIds = [],
  musicDuration = "",
  musicMarkers = [],
  onSnapToMarker,
  currentTimeMs = -1,
  activeRecordIds = [],
}) => {
  const [pxPerSec, setPxPerSec] = useState(DEFAULT_PX_PER_SEC);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [hoveredRecordId, setHoveredRecordId] = useState<string | null>(null);
  const [snappedMarkerId, setSnappedMarkerId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragDataRef = useRef<{
    recordId: string;
    segmentId: string;
    segStartMs: number;
    segEndMs: number;
    durationMs: number;
    originalIgnitionTime: string;
  } | null>(null);

  const musicDurationMs = timeToMs(musicDuration);

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
    if (musicDurationMs > max) max = musicDurationMs;
    return Math.max(max + 30000, 240000);
  }, [segments, records, musicDurationMs]);

  const timelineWidth = (totalTimeMs / 1000) * pxPerSec;

  const sortedSegments = useMemo(() => {
    return [...segments].sort((a, b) => timeToMs(a.startTime) - timeToMs(b.startTime));
  }, [segments]);

  const recordsBySegment = useMemo(() => {
    const map: Record<string, FiringRecord[]> = {};
    segments.forEach((s) => {
      map[s.id] = [];
    });
    records.forEach((r) => {
      if (!map[r.segmentId]) map[r.segmentId] = [];
      map[r.segmentId].push(r);
    });
    Object.keys(map).forEach((segId) => {
      map[segId].sort((a, b) => timeToMs(a.ignitionTime) - timeToMs(b.ignitionTime));
    });
    return map;
  }, [segments, records]);

  const sortedMusicMarkers = useMemo(() => {
    return [...musicMarkers].sort((a, b) => timeToMs(a.time) - timeToMs(b.time));
  }, [musicMarkers]);

  const tickMarks = useMemo(() => {
    const ticks: { ms: number; label: string; major: boolean }[] = [];
    const stepSec = pxPerSec < 40 ? 10 : pxPerSec < 100 ? 5 : pxPerSec < 200 ? 2 : 1;
    const majorEvery = pxPerSec < 40 ? 6 : pxPerSec < 100 ? 6 : pxPerSec < 200 ? 5 : 5;
    for (let ms = 0; ms <= totalTimeMs; ms += stepSec * 1000) {
      const totalSec = Math.floor(ms / 1000);
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      const label = `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
      ticks.push({ ms, label, major: Math.floor(ms / (stepSec * 1000)) % majorEvery === 0 });
    }
    return ticks;
  }, [totalTimeMs, pxPerSec]);

  const findNearestMarker = useCallback((ms: number): { marker: MusicMarker; distancePx: number } | null => {
    let nearest: MusicMarker | null = null;
    let nearestDist = Infinity;
    for (const marker of musicMarkers) {
      const markerMs = timeToMs(marker.time);
      const distPx = Math.abs((markerMs - ms) / 1000) * pxPerSec;
      if (distPx < nearestDist) {
        nearestDist = distPx;
        nearest = marker;
      }
    }
    if (nearest && nearestDist <= SNAP_THRESHOLD_PX) {
      return { marker: nearest, distancePx: nearestDist };
    }
    return null;
  }, [musicMarkers, pxPerSec]);

  const handleZoom = (delta: number) => {
    setPxPerSec((prev) => {
      const ratio = delta > 0 ? 1.2 : 1 / 1.2;
      const next = Math.min(MAX_PX_PER_SEC, Math.max(MIN_PX_PER_SEC, prev * ratio));
      if (scrollRef.current) {
        const viewportWidth = scrollRef.current.clientWidth;
        const center = scrollRef.current.scrollLeft + viewportWidth / 2;
        const centerMs = (center / timelineWidth) * totalTimeMs;
        const newCenter = (centerMs / totalTimeMs) * ((totalTimeMs / 1000) * next);
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollLeft = newCenter - viewportWidth / 2;
          }
        }, 0);
      }
      return next;
    });
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      handleZoom(-e.deltaY);
    }
  }, [timelineWidth, totalTimeMs]);

  const handleNodeMouseDown = (
    e: React.MouseEvent,
    record: FiringRecord,
    nodeX: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const seg = segments.find((s) => s.id === record.segmentId);
    if (!seg) return;

    setDraggingId(record.id);
    setSelectedRecordId(record.id);
    setDragOffsetX(e.clientX - nodeX - SEG_LABEL_WIDTH + (scrollRef.current?.scrollLeft || 0));
    dragDataRef.current = {
      recordId: record.id,
      segmentId: record.segmentId,
      segStartMs: timeToMs(seg.startTime),
      segEndMs: timeToMs(seg.endTime),
      durationMs: durationToMs(record.duration),
      originalIgnitionTime: record.ignitionTime,
    };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!draggingId || !dragDataRef.current || !scrollRef.current) return;

      const scrollContainer = scrollRef.current;
      const rect = scrollContainer.getBoundingClientRect();
      const scrollContainerLeft = rect.left;

      let newX = e.clientX - scrollContainerLeft - dragOffsetX + scrollContainer.scrollLeft;
      const data = dragDataRef.current;

      const segStartX = (data.segStartMs / 1000) * pxPerSec;
      const segEndX = (data.segEndMs / 1000) * pxPerSec;
      const nodeWidth = Math.max(NODE_MIN_WIDTH, (data.durationMs / 1000) * pxPerSec);

      const minX = segStartX;
      const maxX = segEndX - nodeWidth;

      newX = Math.max(minX, Math.min(maxX, newX));

      let newIgnitionMs = (newX / pxPerSec) * 1000;

      const snapResult = findNearestMarker(newIgnitionMs);
      if (snapResult) {
        newIgnitionMs = timeToMs(snapResult.marker.time);
        setSnappedMarkerId(snapResult.marker.id);
      } else {
        setSnappedMarkerId(null);
      }

      const newIgnitionTime = msToTime(newIgnitionMs);

      const record = records.find((r) => r.id === draggingId);
      if (record && record.ignitionTime !== newIgnitionTime) {
        const updated = { ...record, ignitionTime: newIgnitionTime };
        onUpdateRecord(updated);
      }
    },
    [draggingId, dragOffsetX, pxPerSec, records, onUpdateRecord, findNearestMarker]
  );

  const handleMouseUp = useCallback(() => {
    if (draggingId) {
      const record = records.find((r) => r.id === draggingId);
      if (record && dragDataRef.current) {
        const originalTime = dragDataRef.current.originalIgnitionTime;
        if (record.ignitionTime !== originalTime && snappedMarkerId) {
          const marker = musicMarkers.find((m) => m.id === snappedMarkerId);
          if (marker && onSnapToMarker) {
            onSnapToMarker(record.id, marker.id, originalTime, record.ignitionTime);
          }
        }
        onSelectRecord(record);
      }
    }
    setDraggingId(null);
    dragDataRef.current = null;
    setSnappedMarkerId(null);
  }, [draggingId, records, onSelectRecord, snappedMarkerId, musicMarkers, onSnapToMarker]);

  useEffect(() => {
    if (draggingId) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [draggingId, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => setScrollLeft(el.scrollLeft);
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  const getSegmentRowIndex = (segId: string): number => {
    return sortedSegments.findIndex((s) => s.id === segId);
  };

  return (
    <div className="timeline-editor" ref={containerRef}>
      <div className="timeline-toolbar">
        <div className="timeline-zoom-controls">
          <button
            className="zoom-btn"
            onClick={() => handleZoom(-1)}
            title="缩小 (Ctrl+滚轮上)"
          >
            −
          </button>
          <span className="zoom-level">{Math.round((pxPerSec / DEFAULT_PX_PER_SEC) * 100)}%</span>
          <button
            className="zoom-btn"
            onClick={() => handleZoom(1)}
            title="放大 (Ctrl+滚轮下)"
          >
            +
          </button>
          <button
            className="zoom-reset-btn"
            onClick={() => setPxPerSec(DEFAULT_PX_PER_SEC)}
            title="重置缩放"
          >
            重置
          </button>
        </div>
        <div className="timeline-tips">
          <small>提示：Ctrl+滚轮缩放 · 拖动节点调整点火时间 · 节点可吸附到音乐标记{musicMarkers.length > 0 ? ` (${musicMarkers.length}个标记)` : ""}</small>
        </div>
      </div>

      <div
        className="timeline-scroll-container"
        ref={scrollRef}
        onWheel={handleWheel}
      >
        <div
          className="timeline-content"
          style={{
            width: timelineWidth + SEG_LABEL_WIDTH,
            minHeight:
              TIMELINE_HEADER_HEIGHT +
              sortedSegments.length * (ROW_HEIGHT + ROW_GAP) +
              20,
          }}
        >
          <div
            className="timeline-header"
            style={{
              transform: `translateX(${scrollLeft}px)`,
              width: timelineWidth + SEG_LABEL_WIDTH,
            }}
          >
            <div className="timeline-header-label" style={{ width: SEG_LABEL_WIDTH }}>
              段落 / 时间
            </div>
            <div
              className="timeline-ruler"
              style={{ width: timelineWidth, position: "relative" }}
            >
              {tickMarks.map((tick, i) => (
                <div
                  key={`tick-${i}`}
                  className={`timeline-tick ${tick.major ? "major" : "minor"}`}
                  style={{
                    left: (tick.ms / 1000) * pxPerSec,
                    height: tick.major ? 24 : 12,
                  }}
                >
                  {tick.major && (
                    <span className="timeline-tick-label">{tick.label}</span>
                  )}
                </div>
              ))}

              {sortedMusicMarkers.map((marker) => {
                const markerMs = timeToMs(marker.time);
                const markerX = (markerMs / 1000) * pxPerSec;
                const isSnapped = snappedMarkerId === marker.id;
                return (
                  <div
                    key={marker.id}
                    className={`timeline-music-marker ${marker.type} ${isSnapped ? "snapped" : ""}`}
                    style={{ left: markerX }}
                    title={`${marker.label} (${marker.time})`}
                  >
                    <div className={`music-marker-line ${marker.type}`} />
                    <span className="music-marker-label">{marker.label}</span>
                  </div>
                );
              })}

              {musicDurationMs > 0 && (
                <div
                  className="timeline-music-duration-line"
                  style={{ left: (musicDurationMs / 1000) * pxPerSec }}
                >
                  <div className="music-duration-marker" />
                  <span className="music-duration-label">音乐终线 {musicDuration}</span>
                </div>
              )}

              {currentTimeMs >= 0 && (
                <div
                  className="timeline-playhead"
                  style={{ left: (currentTimeMs / 1000) * pxPerSec }}
                >
                  <div className="playhead-triangle" />
                  <div className="playhead-line" />
                </div>
              )}
            </div>
          </div>

          <div className="timeline-body">
            {sortedSegments.map((segment) => {
              const segStartMs = timeToMs(segment.startTime);
              const segEndMs = timeToMs(segment.endTime);
              const rowIndex = getSegmentRowIndex(segment.id);
              const rowTop = rowIndex * (ROW_HEIGHT + ROW_GAP);
              const segRecs = recordsBySegment[segment.id] || [];
              const isSelectedSeg = selectedSegmentId === segment.id;

              return (
                <div
                  key={segment.id}
                  className={`timeline-row ${isSelectedSeg ? "selected" : ""}`}
                  style={{
                    top: rowTop,
                    height: ROW_HEIGHT,
                  }}
                  onClick={() => onSelectSegment(segment.id)}
                >
                  <div
                    className="timeline-seg-label"
                    style={{ width: SEG_LABEL_WIDTH }}
                  >
                    <div
                      className="seg-label-color"
                      style={{ background: segment.themeColor }}
                    />
                    <div className="seg-label-text">
                      <span className="seg-label-type">{segment.type}</span>
                      <span className="seg-label-name" title={segment.name}>
                        {segment.name}
                      </span>
                      <span className="seg-label-time">
                        {segment.startTime.slice(0, 5)}–{segment.endTime.slice(0, 5)}
                      </span>
                    </div>
                  </div>

                  <div className="timeline-track" style={{ width: timelineWidth }}>
                    <div
                      className="timeline-seg-range"
                      style={{
                        left: (segStartMs / 1000) * pxPerSec,
                        width: ((segEndMs - segStartMs) / 1000) * pxPerSec,
                        background: `linear-gradient(180deg, ${segment.themeColor}18 0%, ${segment.themeColor}08 100%)`,
                        borderColor: `${segment.themeColor}50`,
                      }}
                    />

                    <div
                      className="timeline-seg-boundary start"
                      style={{
                        left: (segStartMs / 1000) * pxPerSec,
                        borderColor: `${segment.themeColor}80`,
                      }}
                    />
                    <div
                      className="timeline-seg-boundary end"
                      style={{
                        left: (segEndMs / 1000) * pxPerSec,
                        borderColor: `${segment.themeColor}80`,
                      }}
                    />

                    {sortedMusicMarkers.map((marker) => {
                      const markerMs = timeToMs(marker.time);
                      if (markerMs < segStartMs || markerMs > segEndMs) return null;
                      const isSnapped = snappedMarkerId === marker.id;
                      return (
                        <div
                          key={`track-${marker.id}`}
                          className={`timeline-track-marker ${marker.type} ${isSnapped ? "snapped" : ""}`}
                          style={{
                            left: (markerMs / 1000) * pxPerSec,
                            borderColor: marker.type === "beat" ? "#7c3aed80" : "#05966980",
                          }}
                          title={`${marker.label} (${marker.time})`}
                        />
                      );
                    })}

                    {segRecs.map((record) => {
                      const ignitionMs = timeToMs(record.ignitionTime);
                      const durMs = durationToMs(record.duration);
                      const nodeX = (ignitionMs / 1000) * pxPerSec;
                      const nodeW = Math.max(
                        NODE_MIN_WIDTH,
                        (durMs / 1000) * pxPerSec
                      );
                      const isSelected = selectedRecordId === record.id;
                      const isHovered = hoveredRecordId === record.id;
                      const isDragging = draggingId === record.id;
                      const isHighlighted = highlightedRecordIds.includes(record.id);
                      const hasConflict = conflictRecordIds.includes(record.id);
                      const isActive = activeRecordIds.includes(record.id);

                      const clampedLeft = Math.max(
                        (segStartMs / 1000) * pxPerSec,
                        Math.min(
                          (segEndMs / 1000) * pxPerSec - nodeW,
                          nodeX
                        )
                      );

                      const nodeBg = hasConflict
                        ? `linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)`
                        : isActive
                        ? `linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)`
                        : `linear-gradient(135deg, ${segment.themeColor} 0%, ${segment.themeColor}dd 100%)`;
                      const nodeBorderColor = isSelected
                        ? "#172033"
                        : isActive
                        ? "#f59e0b"
                        : hasConflict
                        ? "#dc2626"
                        : `${segment.themeColor}`;

                      return (
                        <div
                          key={record.id}
                          className={`timeline-node ${
                            isSelected ? "selected" : ""
                          } ${isDragging ? "dragging" : ""} ${
                            isHighlighted ? "highlighted" : ""
                          } ${hasConflict ? "has-conflict" : ""} ${
                            isActive ? "active" : ""
                          }`}
                          style={{
                            left: clampedLeft,
                            width: nodeW,
                            background: nodeBg,
                            borderColor: nodeBorderColor,
                            boxShadow: isDragging
                              ? `0 8px 20px ${hasConflict ? "#dc2626" : segment.themeColor}60`
                              : isActive
                              ? `0 0 0 3px #f59e0b, 0 0 16px #f59e0b80, 0 4px 12px #f59e0b40`
                              : isHighlighted
                              ? `0 0 0 3px #f59e0b, 0 4px 12px ${hasConflict ? "#dc2626" : segment.themeColor}50`
                              : isSelected
                              ? `0 4px 12px ${hasConflict ? "#dc2626" : segment.themeColor}50`
                              : isHovered
                              ? `0 2px 8px ${hasConflict ? "#dc2626" : segment.themeColor}30`
                              : "none",
                          }}
                          onMouseDown={(e) =>
                            handleNodeMouseDown(e, record, clampedLeft)
                          }
                          onMouseEnter={() => setHoveredRecordId(record.id)}
                          onMouseLeave={() => setHoveredRecordId(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecordId(record.id);
                            onSelectRecord(record);
                          }}
                        >
                          <div className="timeline-node-content">
                            <span
                              className="timeline-node-model"
                              title={record.model}
                            >
                              {record.model || "未命名"}
                            </span>
                            {nodeW > 80 && (
                              <span className="timeline-node-time">
                                {record.ignitionTime.slice(3, 8)}
                              </span>
                            )}
                          </div>
                          <div className="timeline-node-handle left" />
                          <div className="timeline-node-handle right" />
                        </div>
                      );
                    })}

                    {segRecs.length === 0 && (
                      <div
                        className="timeline-empty-hint"
                        style={{
                          left: (segStartMs / 1000) * pxPerSec + 8,
                        }}
                      >
                        暂无点火记录
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {currentTimeMs >= 0 && (
              <div
                className="timeline-playhead-overlay"
                style={{
                  left: SEG_LABEL_WIDTH + (currentTimeMs / 1000) * pxPerSec,
                }}
              >
                <div className="playhead-overlay-line" />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="timeline-footer">
        <div className="timeline-stats">
          <span>
            总时长：<strong>{msToTime(totalTimeMs - 30000 < 0 ? totalTimeMs : totalTimeMs - 30000).slice(0, 8)}</strong>
          </span>
          <span>
            段落数：<strong>{segments.length}</strong>
          </span>
          <span>
            节点数：<strong>{records.length}</strong>
          </span>
          {musicDurationMs > 0 && (
            <span>
              音乐时长：<strong>{musicDuration}</strong>
            </span>
          )}
          {musicMarkers.length > 0 && (
            <span>
              音乐标记：<strong>{musicMarkers.length}</strong>
            </span>
          )}
        </div>
        {selectedRecordId && (
          <div className="timeline-selected-info">
            {(() => {
              const rec = records.find((r) => r.id === selectedRecordId);
              if (!rec) return null;
              const seg = segments.find((s) => s.id === rec.segmentId);
              return (
                <>
                  <span className="sel-info-label">已选中：</span>
                  <span
                    className="sel-info-tag"
                    style={{
                      background: `${seg?.themeColor}15`,
                      color: seg?.themeColor,
                      borderColor: `${seg?.themeColor}40`,
                    }}
                  >
                    {seg?.type}
                  </span>
                  <strong>{rec.model}</strong>
                  <span className="sel-info-time">
                    点火 {rec.ignitionTime} · 持续 {rec.duration || "?"}
                  </span>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineEditor;
