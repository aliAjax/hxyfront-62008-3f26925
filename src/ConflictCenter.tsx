import { useMemo, useState } from "react";
import {
  Conflict,
  ConflictSeverity,
  ConflictType,
  FiringRecord,
  FiringPoint,
  getConflictTypeLabel,
  getSeverityColor,
  getSeverityLabel,
} from "./conflictDetection";

interface ConflictCenterProps {
  conflicts: Conflict[];
  records: FiringRecord[];
  firingPoints: FiringPoint[];
  selectedConflictId: string | null;
  onSelectConflict: (conflictId: string | null) => void;
  onHighlightRecords: (recordIds: string[]) => void;
  onHighlightPoints: (pointIds: string[]) => void;
  onLocateRecord: (recordId: string) => void;
}

const ConflictCenter: React.FC<ConflictCenterProps> = ({
  conflicts,
  records,
  firingPoints,
  selectedConflictId,
  onSelectConflict,
  onHighlightRecords,
  onHighlightPoints,
  onLocateRecord,
}) => {
  const [severityFilter, setSeverityFilter] = useState<ConflictSeverity | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ConflictType | "all">("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const stats = useMemo(() => {
    const critical = conflicts.filter((c) => c.severity === "critical").length;
    const warning = conflicts.filter((c) => c.severity === "warning").length;
    const info = conflicts.filter((c) => c.severity === "info").length;
    return { critical, warning, info, total: conflicts.length };
  }, [conflicts]);

  const filteredConflicts = useMemo(() => {
    return conflicts.filter((c) => {
      const matchSeverity = severityFilter === "all" || c.severity === severityFilter;
      const matchType = typeFilter === "all" || c.type === typeFilter;
      return matchSeverity && matchType;
    });
  }, [conflicts, severityFilter, typeFilter]);

  const getRecordById = (id: string): FiringRecord | undefined =>
    records.find((r) => r.id === id);

  const getPointById = (id: string): FiringPoint | undefined =>
    firingPoints.find((p) => p.id === id);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConflictClick = (conflict: Conflict) => {
    if (selectedConflictId === conflict.id) {
      onSelectConflict(null);
      onHighlightRecords([]);
      onHighlightPoints([]);
    } else {
      onSelectConflict(conflict.id);
      onHighlightRecords(conflict.involvedRecordIds);
      onHighlightPoints(conflict.involvedPointIds);
    }
    toggleExpand(conflict.id);
  };

  return (
    <div className="conflict-center">
      <div className="conflict-stats">
        <div
          className="conflict-stat-item critical"
          onClick={() =>
            setSeverityFilter(severityFilter === "critical" ? "all" : "critical")
          }
          style={{ cursor: "pointer" }}
        >
          <span className="stat-label">严重</span>
          <strong className="stat-value">{stats.critical}</strong>
        </div>
        <div
          className="conflict-stat-item warning"
          onClick={() =>
            setSeverityFilter(severityFilter === "warning" ? "all" : "warning")
          }
          style={{ cursor: "pointer" }}
        >
          <span className="stat-label">警告</span>
          <strong className="stat-value">{stats.warning}</strong>
        </div>
        <div
          className="conflict-stat-item info"
          onClick={() =>
            setSeverityFilter(severityFilter === "info" ? "all" : "info")
          }
          style={{ cursor: "pointer" }}
        >
          <span className="stat-label">提示</span>
          <strong className="stat-value">{stats.info}</strong>
        </div>
        <div className="conflict-stat-item total">
          <span className="stat-label">总计</span>
          <strong className="stat-value">{stats.total}</strong>
        </div>
      </div>

      <div className="conflict-toolbar">
        <div className="conflict-filter-group">
          <span className="filter-label">严重等级：</span>
          <div className="chips">
            <button
              className={severityFilter === "all" ? "active" : ""}
              onClick={() => setSeverityFilter("all")}
            >
              全部
            </button>
            <button
              className={severityFilter === "critical" ? "active" : ""}
              onClick={() => setSeverityFilter("critical")}
              style={{
                borderColor: severityFilter === "critical" ? "#dc2626" : undefined,
                background: severityFilter === "critical" ? "#dc2626" : undefined,
                color: severityFilter === "critical" ? "#fff" : undefined,
              }}
            >
              严重
            </button>
            <button
              className={severityFilter === "warning" ? "active" : ""}
              onClick={() => setSeverityFilter("warning")}
              style={{
                borderColor: severityFilter === "warning" ? "#f59e0b" : undefined,
                background: severityFilter === "warning" ? "#f59e0b" : undefined,
                color: severityFilter === "warning" ? "#fff" : undefined,
              }}
            >
              警告
            </button>
            <button
              className={severityFilter === "info" ? "active" : ""}
              onClick={() => setSeverityFilter("info")}
              style={{
                borderColor: severityFilter === "info" ? "#1d4ed8" : undefined,
                background: severityFilter === "info" ? "#1d4ed8" : undefined,
                color: severityFilter === "info" ? "#fff" : undefined,
              }}
            >
              提示
            </button>
          </div>
        </div>

        <div className="conflict-filter-group">
          <span className="filter-label">冲突类型：</span>
          <div className="chips">
            <button
              className={typeFilter === "all" ? "active" : ""}
              onClick={() => setTypeFilter("all")}
            >
              全部
            </button>
            <button
              className={typeFilter === "time_overlap" ? "active" : ""}
              onClick={() => setTypeFilter("time_overlap")}
            >
              时间重叠
            </button>
            <button
              className={typeFilter === "safety_distance" ? "active" : ""}
              onClick={() => setTypeFilter("safety_distance")}
            >
              安全距离
            </button>
            <button
              className={typeFilter === "same_point_interval" ? "active" : ""}
              onClick={() => setTypeFilter("same_point_interval")}
            >
              发射间隔
            </button>
          </div>
        </div>
      </div>

      <div className="conflict-list">
        {filteredConflicts.length > 0 ? (
          filteredConflicts.map((conflict) => {
            const isSelected = selectedConflictId === conflict.id;
            const isExpanded = expandedIds.has(conflict.id);
            const severityColor = getSeverityColor(conflict.severity);

            return (
              <div
                key={conflict.id}
                className={`conflict-item ${isSelected ? "selected" : ""} ${
                  conflict.severity
                }`}
                style={{
                  borderLeftColor: severityColor,
                }}
                onClick={() => handleConflictClick(conflict)}
              >
                <div className="conflict-item-header">
                  <div
                    className="conflict-severity-badge"
                    style={{
                      background: severityColor,
                    }}
                  >
                    {getSeverityLabel(conflict.severity)}
                  </div>
                  <div className="conflict-type-tag">
                    {getConflictTypeLabel(conflict.type)}
                  </div>
                  <div className="conflict-title">{conflict.title}</div>
                  <div className="conflict-expand-icon">{isExpanded ? "−" : "+"}</div>
                </div>

                {isExpanded && (
                  <div className="conflict-item-body">
                    <div className="conflict-description">
                      <span className="body-label">冲突描述：</span>
                      <p>{conflict.description}</p>
                    </div>

                    <div className="conflict-involved">
                      <span className="body-label">涉及点火节点：</span>
                      <div className="conflict-record-tags">
                        {conflict.involvedRecordIds.map((rid) => {
                          const rec = getRecordById(rid);
                          return (
                            <button
                              key={rid}
                              className="conflict-record-tag"
                              onClick={(e) => {
                                e.stopPropagation();
                                onLocateRecord(rid);
                              }}
                            >
                              {rec?.model || rid}
                              <span className="record-time">
                                {rec?.ignitionTime || ""}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {conflict.involvedPointIds.length > 0 && (
                      <div className="conflict-involved">
                        <span className="body-label">涉及点位：</span>
                        <div className="conflict-point-tags">
                          {conflict.involvedPointIds.map((pid) => {
                            const point = getPointById(pid);
                            return (
                              <span key={pid} className="conflict-point-tag">
                                {point?.name || pid}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div
                      className="conflict-suggestion"
                      style={{
                        borderLeftColor: severityColor,
                      }}
                    >
                      <span className="body-label">建议调整方向：</span>
                      <p>{conflict.suggestion}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="conflict-empty">
            {conflicts.length === 0 ? (
              <>
                <div className="conflict-empty-icon">✓</div>
                <p>未检测到冲突，编排状态良好！</p>
              </>
            ) : (
              <p>当前筛选条件下无匹配的冲突记录</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConflictCenter;
