export type ConflictSeverity = "critical" | "warning" | "info";

export type ConflictType =
  | "time_overlap"
  | "safety_distance"
  | "same_point_interval";

export interface Segment {
  id: string;
  name: string;
  type: "Intro" | "Chorus" | "Bridge" | "Finale" | "Other";
  startTime: string;
  endTime: string;
  themeColor: string;
  notes: string;
}

export interface FiringRecord {
  id: string;
  segmentId: string;
  model: string;
  caliber: string;
  angle: string;
  ignitionTime: string;
  duration: string;
  safetyDistance: string;
  remark: string;
  firingPointId?: string;
}

export interface Zone {
  id: string;
  name: "A区" | "B区" | "近景区" | "观众区";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface FiringPoint {
  id: string;
  name: string;
  zoneId: string;
  x: number;
  y: number;
  safetyDistance: number;
  assignedModel: string;
  notes: string;
}

export interface Conflict {
  id: string;
  type: ConflictType;
  severity: ConflictSeverity;
  title: string;
  description: string;
  suggestion: string;
  involvedRecordIds: string[];
  involvedPointIds: string[];
  details: {
    overlapMs?: number;
    distanceMeters?: number;
    requiredDistanceMeters?: number;
    intervalMs?: number;
    requiredIntervalMs?: number;
  };
}

export const timeToMs = (time: string): number => {
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

export const durationToMs = (duration: string): number => {
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

export const parseSafetyDistance = (safetyDistance: string): number => {
  if (!safetyDistance) return 0;
  const match = safetyDistance.match(/^(\d+(?:\.\d+)?)\s*m?$/i);
  if (match) {
    return parseFloat(match[1]);
  }
  return 0;
};

export const parseAngle = (angle: string): number => {
  if (!angle) return 0;
  const match = angle.match(/^(\d+(?:\.\d+)?)\s*°?$/);
  if (match) {
    return parseFloat(match[1]);
  }
  return 0;
};

const getAbsoluteIgnitionMs = (
  record: FiringRecord,
  segments: Segment[]
): number => {
  const seg = segments.find((s) => s.id === record.segmentId);
  const segStart = seg ? timeToMs(seg.startTime) : 0;
  return segStart + timeToMs(record.ignitionTime);
};

const getRecordEndMs = (
  record: FiringRecord,
  segments: Segment[]
): number => {
  return getAbsoluteIgnitionMs(record, segments) + durationToMs(record.duration);
};

const getPointById = (
  points: FiringPoint[],
  id?: string
): FiringPoint | null => {
  if (!id) return null;
  return points.find((p) => p.id === id) || null;
};

const calculateDistance = (p1: FiringPoint, p2: FiringPoint): number => {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const pixelDistance = Math.sqrt(dx * dx + dy * dy);
  return pixelDistance * 0.25;
};

const generateId = (): string => `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const detectTimeOverlap = (
  records: FiringRecord[],
  segments: Segment[]
): Conflict[] => {
  const conflicts: Conflict[] = [];
  const sorted = [...records].sort(
    (a, b) => getAbsoluteIgnitionMs(a, segments) - getAbsoluteIgnitionMs(b, segments)
  );

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      const aStart = getAbsoluteIgnitionMs(a, segments);
      const aEnd = getRecordEndMs(a, segments);
      const bStart = getAbsoluteIgnitionMs(b, segments);
      const bEnd = getRecordEndMs(b, segments);

      const overlapStart = Math.max(aStart, bStart);
      const overlapEnd = Math.min(aEnd, bEnd);
      const overlapMs = overlapEnd - overlapStart;

      if (overlapMs > 0) {
        const isAngleConflict =
          parseAngle(a.angle) === parseAngle(b.angle) &&
          parseAngle(a.angle) > 0;
        const severity: ConflictSeverity =
          overlapMs >= 1500 ? "critical" : overlapMs >= 500 ? "warning" : "info";

        let title = "燃放时间重叠";
        if (isAngleConflict) {
          title = "同角度时间重叠";
        }

        conflicts.push({
          id: generateId(),
          type: "time_overlap",
          severity,
          title,
          description: `节点 [${a.model || a.id}] 与 [${b.model || b.id}] 时间重叠 ${(overlapMs / 1000).toFixed(2)} 秒${
            isAngleConflict ? `，且发射角度相同（${a.angle}）` : ""
          }`,
          suggestion:
            severity === "critical"
              ? `严重重叠！建议将其中一个节点点火时间错开至少 ${(overlapMs / 1000 + 0.5).toFixed(1)} 秒，或调整发射角度避免同向`
              : severity === "warning"
              ? `建议错开点火时间 ${Math.ceil((overlapMs + 200) / 100) / 10} 秒以上`
              : "轻微重叠，可根据现场效果决定是否调整",
          involvedRecordIds: [a.id, b.id],
          involvedPointIds: [a.firingPointId, b.firingPointId].filter(
            (id): id is string => !!id
          ),
          details: { overlapMs },
        });
      }

      if (bStart > aEnd) break;
    }
  }

  return conflicts;
};

const detectSafetyDistance = (
  records: FiringRecord[],
  segments: Segment[],
  firingPoints: FiringPoint[]
): Conflict[] => {
  const conflicts: Conflict[] = [];
  const sorted = [...records].sort(
    (a, b) => getAbsoluteIgnitionMs(a, segments) - getAbsoluteIgnitionMs(b, segments)
  );

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      const aStart = getAbsoluteIgnitionMs(a, segments);
      const aEnd = getRecordEndMs(a, segments);
      const bStart = getAbsoluteIgnitionMs(b, segments);
      const bEnd = getRecordEndMs(b, segments);

      const timeWindowStart = Math.min(aStart, bStart);
      const timeWindowEnd = Math.max(aEnd, bEnd);
      const timeDiff = Math.abs(bStart - aStart);

      if (timeDiff > 10000) continue;

      const overlapStart = Math.max(aStart, bStart);
      const overlapEnd = Math.min(aEnd, bEnd);
      const hasTimeOverlap = overlapEnd - overlapStart > -1000;

      if (!hasTimeOverlap && timeDiff > 3000) continue;

      const pointA = getPointById(firingPoints, a.firingPointId);
      const pointB = getPointById(firingPoints, b.firingPointId);

      if (!pointA || !pointB) continue;
      if (pointA.id === pointB.id) continue;

      const distance = calculateDistance(pointA, pointB);
      const safetyA = pointA.safetyDistance || parseSafetyDistance(a.safetyDistance);
      const safetyB = pointB.safetyDistance || parseSafetyDistance(b.safetyDistance);
      const requiredDistance = Math.max(safetyA, safetyB);

      if (distance < requiredDistance) {
        const deficit = requiredDistance - distance;
        const severity: ConflictSeverity =
          deficit >= requiredDistance * 0.5
            ? "critical"
            : deficit >= requiredDistance * 0.2
            ? "warning"
            : "info";

        conflicts.push({
          id: generateId(),
          type: "safety_distance",
          severity,
          title: "安全距离不足",
          description: `点位 ${pointA.name} 与 ${pointB.name} 实际距离 ${distance.toFixed(
            1
          )}m，低于要求的 ${requiredDistance}m（相差 ${deficit.toFixed(1)}m），时间窗口 ${(
            (timeWindowEnd - timeWindowStart) /
            1000
          ).toFixed(1)} 秒内`,
          suggestion:
            severity === "critical"
              ? `严重安全隐患！建议更换点位，或将点火时间错开至少 5 秒以上`
              : severity === "warning"
              ? `建议调整点位位置拉开 ${Math.ceil(deficit)}m 距离，或错开点火时间 3 秒以上`
              : "接近安全距离临界值，建议根据实际场地情况确认",
          involvedRecordIds: [a.id, b.id],
          involvedPointIds: [pointA.id, pointB.id],
          details: {
            distanceMeters: distance,
            requiredDistanceMeters: requiredDistance,
          },
        });
      }
    }
  }

  return conflicts;
};

const detectSamePointInterval = (
  records: FiringRecord[],
  segments: Segment[],
  firingPoints: FiringPoint[]
): Conflict[] => {
  const conflicts: Conflict[] = [];
  const MIN_INTERVAL_MS = 2000;

  const recordsByPoint = new Map<string, FiringRecord[]>();
  records.forEach((r) => {
    if (r.firingPointId) {
      const list = recordsByPoint.get(r.firingPointId) || [];
      list.push(r);
      recordsByPoint.set(r.firingPointId, list);
    }
  });

  recordsByPoint.forEach((pointRecords, pointId) => {
    const point = getPointById(firingPoints, pointId);
    const sorted = [...pointRecords].sort(
      (a, b) =>
        getAbsoluteIgnitionMs(a, segments) - getAbsoluteIgnitionMs(b, segments)
    );

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      const currentEnd = getRecordEndMs(current, segments);
      const nextStart = getAbsoluteIgnitionMs(next, segments);
      const intervalMs = nextStart - currentEnd;

      if (intervalMs < MIN_INTERVAL_MS) {
        const severity: ConflictSeverity =
          intervalMs < 500
            ? "critical"
            : intervalMs < 1000
            ? "warning"
            : "info";

        conflicts.push({
          id: generateId(),
          type: "same_point_interval",
          severity,
          title: "同点位连续发射间隔过短",
          description: `点位 ${
            point?.name || pointId
          } 连续发射间隔仅 ${(intervalMs / 1000).toFixed(
            2
          )} 秒，要求至少 ${(MIN_INTERVAL_MS / 1000).toFixed(1)} 秒。节点：[${
            current.model || current.id
          }] → [${next.model || next.id}]`,
          suggestion:
            severity === "critical"
              ? `发射间隔严重不足！建议将后续节点点火时间推迟至少 ${(
                  (MIN_INTERVAL_MS - intervalMs) /
                  1000
                ).toFixed(1)} 秒，避免炸筒风险`
              : severity === "warning"
              ? `建议增加发射间隔至 ${(MIN_INTERVAL_MS / 1000).toFixed(
                  1
                )} 秒以上，确保发射管冷却`
              : "接近安全间隔临界值，建议确认烟花型号的冷却要求",
          involvedRecordIds: [current.id, next.id],
          involvedPointIds: [pointId],
          details: {
            intervalMs,
            requiredIntervalMs: MIN_INTERVAL_MS,
          },
        });
      }
    }
  });

  return conflicts;
};

export const detectConflicts = (
  records: FiringRecord[],
  segments: Segment[],
  firingPoints: FiringPoint[]
): Conflict[] => {
  const timeConflicts = detectTimeOverlap(records, segments);
  const distanceConflicts = detectSafetyDistance(records, segments, firingPoints);
  const intervalConflicts = detectSamePointInterval(records, segments, firingPoints);

  const allConflicts = [...timeConflicts, ...distanceConflicts, ...intervalConflicts];

  const severityOrder: Record<ConflictSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return allConflicts.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );
};

export const getSeverityColor = (severity: ConflictSeverity): string => {
  switch (severity) {
    case "critical":
      return "#dc2626";
    case "warning":
      return "#f59e0b";
    case "info":
      return "#1d4ed8";
  }
};

export const getSeverityLabel = (severity: ConflictSeverity): string => {
  switch (severity) {
    case "critical":
      return "严重";
    case "warning":
      return "警告";
    case "info":
      return "提示";
  }
};

export const getConflictTypeLabel = (type: ConflictType): string => {
  switch (type) {
    case "time_overlap":
      return "时间重叠";
    case "safety_distance":
      return "安全距离";
    case "same_point_interval":
      return "发射间隔";
  }
};
