import { useState, useMemo } from "react";

export interface MusicMarker {
  id: string;
  time: string;
  label: string;
  type: "beat" | "segment-entry";
}

export interface SnapHistoryEntry {
  recordId: string;
  originalTime: string;
  snappedTime: string;
  markerId: string;
}

interface MusicSyncProps {
  musicDuration: string;
  markers: MusicMarker[];
  onDurationChange: (duration: string) => void;
  onMarkersChange: (markers: MusicMarker[]) => void;
  snapHistory: SnapHistoryEntry[];
  onUndoSnap: (entry: SnapHistoryEntry) => void;
  onClearSnapHistory: () => void;
  segments: { id: string; name: string; startTime: string; endTime: string; themeColor: string }[];
  records: { id: string; ignitionTime: string; duration?: string; model?: string }[];
}

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

const msToTime = (ms: number): string => {
  ms = Math.max(0, Math.round(ms));
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  const milliseconds = ms % 1000;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
};

const SNAP_TOLERANCE_MS = 500;

const MusicSync: React.FC<MusicSyncProps> = ({
  musicDuration,
  markers,
  onDurationChange,
  onMarkersChange,
  snapHistory,
  onUndoSnap,
  onClearSnapHistory,
  segments,
  records,
}) => {
  const [newMarkerTime, setNewMarkerTime] = useState("");
  const [newMarkerLabel, setNewMarkerLabel] = useState("");
  const [newMarkerType, setNewMarkerType] = useState<MusicMarker["type"]>("beat");
  const [editingMarkerId, setEditingMarkerId] = useState<string | null>(null);
  const [editingMarker, setEditingMarker] = useState<MusicMarker | null>(null);
  const [durationInput, setDurationInput] = useState(musicDuration);
  const [showSnapPanel, setShowSnapPanel] = useState(false);

  const durationMs = timeToMs(musicDuration);

  const duplicateWarnings = useMemo(() => {
    const warnings: { ids: string[]; time: string }[] = [];
    const timeMap: Record<string, string[]> = {};
    markers.forEach((m) => {
      const ms = timeToMs(m.time);
      const rounded = msToTime(ms);
      if (!timeMap[rounded]) timeMap[rounded] = [];
      timeMap[rounded].push(m.id);
    });
    Object.entries(timeMap).forEach(([time, ids]) => {
      if (ids.length > 1) {
        warnings.push({ ids, time });
      }
    });
    return warnings;
  }, [markers]);

  const outOfBoundsWarnings = useMemo(() => {
    if (durationMs <= 0) return [];
    const warnings: { id: string; name: string; time: string; endTime?: string; type: "marker" | "segment" | "record" }[] = [];
    markers.forEach((m) => {
      if (timeToMs(m.time) > durationMs) {
        warnings.push({ id: m.id, name: m.label, time: m.time, type: "marker" });
      }
    });
    segments.forEach((s) => {
      if (timeToMs(s.endTime) > durationMs) {
        warnings.push({ id: s.id, name: s.name, time: s.endTime, type: "segment" });
      }
    });
    records.forEach((r) => {
      const ignMs = timeToMs(r.ignitionTime);
      const durMs = r.duration ? timeToMs(r.duration) : 0;
      const endMs = ignMs + durMs;
      if (endMs > durationMs) {
        warnings.push({
          id: r.id,
          name: r.model || r.id,
          time: r.ignitionTime,
          endTime: msToTime(endMs),
          type: "record",
        });
      }
    });
    return warnings;
  }, [durationMs, markers, segments, records]);

  const sortedMarkers = useMemo(() => {
    return [...markers].sort((a, b) => timeToMs(a.time) - timeToMs(b.time));
  }, [markers]);

  const handleDurationSubmit = () => {
    const ms = timeToMs(durationInput);
    if (ms <= 0) {
      alert("音乐总时长必须大于 0");
      setDurationInput(musicDuration);
      return;
    }
    onDurationChange(durationInput);
  };

  const handleAddMarker = () => {
    if (!newMarkerTime.trim()) {
      alert("请填写标记时间");
      return;
    }
    const ms = timeToMs(newMarkerTime);
    if (ms <= 0) {
      alert("标记时间必须大于 0");
      return;
    }
    if (durationMs > 0 && ms > durationMs) {
      alert(`标记时间 ${newMarkerTime} 超出音乐总时长 ${musicDuration}`);
      return;
    }
    const duplicate = markers.find(
      (m) => Math.abs(timeToMs(m.time) - ms) < 1
    );
    if (duplicate) {
      alert(`已存在相同时间的标记「${duplicate.label}」(${duplicate.time})`);
      return;
    }
    const nearDuplicate = markers.find(
      (m) => Math.abs(timeToMs(m.time) - ms) < SNAP_TOLERANCE_MS && timeToMs(m.time) !== ms
    );
    if (nearDuplicate) {
      const confirmed = window.confirm(
        `已存在相近标记「${nearDuplicate.label}」(${nearDuplicate.time})，差距 ${Math.abs(timeToMs(nearDuplicate.time) - ms)}ms，是否仍要添加？`
      );
      if (!confirmed) return;
    }
    const marker: MusicMarker = {
      id: `mk-${Date.now()}`,
      time: msToTime(ms),
      label: newMarkerLabel.trim() || `标记 ${markers.length + 1}`,
      type: newMarkerType,
    };
    onMarkersChange([...markers, marker]);
    setNewMarkerTime("");
    setNewMarkerLabel("");
    setNewMarkerType("beat");
  };

  const handleDeleteMarker = (id: string) => {
    onMarkersChange(markers.filter((m) => m.id !== id));
    if (editingMarkerId === id) {
      setEditingMarkerId(null);
      setEditingMarker(null);
    }
  };

  const handleEditMarker = (marker: MusicMarker) => {
    setEditingMarkerId(marker.id);
    setEditingMarker({ ...marker });
  };

  const handleSaveEditMarker = () => {
    if (!editingMarker) return;
    const ms = timeToMs(editingMarker.time);
    if (ms <= 0) {
      alert("标记时间必须大于 0");
      return;
    }
    if (durationMs > 0 && ms > durationMs) {
      alert(`标记时间超出音乐总时长 ${musicDuration}`);
      return;
    }
    const duplicate = markers.find(
      (m) => Math.abs(timeToMs(m.time) - ms) < 1 && m.id !== editingMarker.id
    );
    if (duplicate) {
      alert(`已存在相同时间的标记「${duplicate.label}」(${duplicate.time})`);
      return;
    }
    onMarkersChange(
      markers.map((m) =>
        m.id === editingMarker.id
          ? { ...editingMarker, time: msToTime(ms) }
          : m
      )
    );
    setEditingMarkerId(null);
    setEditingMarker(null);
  };

  const handleCancelEdit = () => {
    setEditingMarkerId(null);
    setEditingMarker(null);
  };

  const handleAutoSegmentEntries = () => {
    const newMarkers: MusicMarker[] = [];
    segments.forEach((seg) => {
      const startMs = timeToMs(seg.startTime);
      const exists = markers.some(
        (m) => Math.abs(timeToMs(m.time) - startMs) < 1
      );
      if (!exists) {
        newMarkers.push({
          id: `mk-seg-${seg.id}-${Date.now()}`,
          time: msToTime(startMs),
          label: `${seg.name} 入点`,
          type: "segment-entry",
        });
      }
    });
    if (newMarkers.length === 0) {
      alert("所有段落入点已存在对应标记");
      return;
    }
    onMarkersChange([...markers, ...newMarkers]);
  };

  return (
    <div className="music-sync">
      <div className="music-sync-duration">
        <label className="music-duration-field">
          <span>音乐总时长</span>
          <div className="duration-input-row">
            <input
              value={durationInput}
              onChange={(e) => setDurationInput(e.target.value)}
              placeholder="MM:SS.mmm"
              className="time-input-ms"
            />
            <button className="primary" onClick={handleDurationSubmit}>
              设置
            </button>
          </div>
          {durationMs > 0 && (
            <small className="duration-display">
              解析为 {msToTime(durationMs)}（{durationMs}ms）
            </small>
          )}
        </label>

        <div className="music-sync-actions">
          <button onClick={handleAutoSegmentEntries} title="自动为每个段落开始时间创建入点标记">
            自动生成段落入点
          </button>
          <button
            onClick={() => setShowSnapPanel(!showSnapPanel)}
            title="查看吸附撤销历史"
          >
            吸附历史 {snapHistory.length > 0 ? `(${snapHistory.length})` : ""}
          </button>
        </div>
      </div>

      {outOfBoundsWarnings.length > 0 && (
        <div className="music-sync-warnings">
          <h4>越界警告</h4>
          <p className="warning-desc">
            音乐总时长缩短后，以下项目超出范围：
          </p>
          <div className="warning-list">
            {outOfBoundsWarnings.map((w) => {
              const exceedMs = w.endTime
                ? timeToMs(w.endTime) - durationMs
                : timeToMs(w.time) - durationMs;
              return (
                <div key={w.id} className="warning-item">
                  <span className={`warning-type tag-${w.type}`}>
                    {w.type === "marker" ? "标记" : w.type === "segment" ? "段落" : "点火"}
                  </span>
                  <span className="warning-name">{w.name}</span>
                  <span className="warning-time">
                    {w.endTime ? `${w.time} → ${w.endTime}` : w.time}
                  </span>
                  <span className="warning-exceed">
                    超出 {exceedMs}ms
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {duplicateWarnings.length > 0 && (
        <div className="music-sync-duplicates">
          <h4>重复标记警告</h4>
          {duplicateWarnings.map((dw) => (
            <div key={dw.time} className="duplicate-item">
              <span>时间 {dw.time} 存在 {dw.ids.length} 个重复标记</span>
            </div>
          ))}
        </div>
      )}

      <div className="music-sync-marker-form">
        <h4>新增音乐标记</h4>
        <div className="marker-form-row">
          <label>
            <span>时间 (MM:SS.mmm)</span>
            <input
              value={newMarkerTime}
              onChange={(e) => setNewMarkerTime(e.target.value)}
              placeholder="00:00.000"
              className="time-input-ms"
            />
          </label>
          <label>
            <span>标签</span>
            <input
              value={newMarkerLabel}
              onChange={(e) => setNewMarkerLabel(e.target.value)}
              placeholder="例如：主旋律入点"
            />
          </label>
          <label>
            <span>类型</span>
            <select
              value={newMarkerType}
              onChange={(e) =>
                setNewMarkerType(e.target.value as MusicMarker["type"])
              }
            >
              <option value="beat">关键节拍</option>
              <option value="segment-entry">段落入点</option>
            </select>
          </label>
          <button className="primary" onClick={handleAddMarker}>
            添加标记
          </button>
        </div>
      </div>

      <div className="music-sync-marker-list">
        <h4>
          音乐标记
          <small style={{ marginLeft: 8, fontWeight: 400, color: "#64748b" }}>
            共 {markers.length} 个
          </small>
        </h4>
        {sortedMarkers.length > 0 ? (
          <div className="marker-items">
            {sortedMarkers.map((marker) => {
              const ms = timeToMs(marker.time);
              const isOutOfBounds = durationMs > 0 && ms > durationMs;
              const isEditing = editingMarkerId === marker.id;

              return (
                <div
                  key={marker.id}
                  className={`marker-item ${isOutOfBounds ? "out-of-bounds" : ""} ${isEditing ? "editing" : ""}`}
                >
                  {isEditing && editingMarker ? (
                    <div className="marker-edit-row">
                      <input
                        value={editingMarker.time}
                        onChange={(e) =>
                          setEditingMarker({ ...editingMarker, time: e.target.value })
                        }
                        className="time-input-ms"
                        placeholder="MM:SS.mmm"
                      />
                      <input
                        value={editingMarker.label}
                        onChange={(e) =>
                          setEditingMarker({ ...editingMarker, label: e.target.value })
                        }
                        placeholder="标签"
                      />
                      <select
                        value={editingMarker.type}
                        onChange={(e) =>
                          setEditingMarker({
                            ...editingMarker,
                            type: e.target.value as MusicMarker["type"],
                          })
                        }
                      >
                        <option value="beat">关键节拍</option>
                        <option value="segment-entry">段落入点</option>
                      </select>
                      <button className="primary" onClick={handleSaveEditMarker}>
                        保存
                      </button>
                      <button onClick={handleCancelEdit}>取消</button>
                    </div>
                  ) : (
                    <>
                      <span className={`marker-type-dot ${marker.type}`} />
                      <span className="marker-time">{marker.time}</span>
                      <span className="marker-label">{marker.label}</span>
                      <span className={`marker-type-tag tag-${marker.type}`}>
                        {marker.type === "beat" ? "节拍" : "入点"}
                      </span>
                      {isOutOfBounds && (
                        <span className="marker-oob">越界</span>
                      )}
                      <div className="marker-actions">
                        <button
                          className="edit-btn"
                          onClick={() => handleEditMarker(marker)}
                        >
                          编辑
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => handleDeleteMarker(marker.id)}
                        >
                          ×
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state" style={{ minHeight: 80 }}>
            <p>暂无音乐标记，请添加</p>
          </div>
        )}
      </div>

      {showSnapPanel && (
        <div className="music-sync-snap-panel">
          <div className="snap-panel-header">
            <h4>吸附撤销历史</h4>
            <div className="snap-panel-actions">
              {snapHistory.length > 0 && (
                <button onClick={onClearSnapHistory}>清空历史</button>
              )}
              <button onClick={() => setShowSnapPanel(false)}>关闭</button>
            </div>
          </div>
          {snapHistory.length > 0 ? (
            <div className="snap-history-list">
              {snapHistory.map((entry, idx) => (
                <div key={idx} className="snap-history-item">
                  <span className="snap-idx">#{idx + 1}</span>
                  <span className="snap-info">
                    {entry.originalTime} → {entry.snappedTime}
                  </span>
                  <button
                    className="snap-undo-btn"
                    onClick={() => onUndoSnap(entry)}
                  >
                    撤销吸附
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="snap-empty">暂无吸附记录</p>
          )}
        </div>
      )}
    </div>
  );
};

export default MusicSync;
