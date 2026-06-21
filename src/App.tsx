import { useState } from "react";
import "./styles.css";

const project = {
  sourceNo: 10,
  id: "hxyfront-62008",
  port: 62008,
  title: "烟花燃放脚本编排",
  domain: "烟花燃放编排",
  prompt:
    "我想做一个面向烟花燃放编排师的燃放脚本前端工具，可以记录节目段落、烟花型号、口径、发射角度、点火时间、持续时间、安全距离和音乐时间点。页面需要有时间轴编排、燃放点位平面图、型号清单、冲突时间提示和整场节目预览。",
  palette: ["#1d4ed8", "#dc2626", "#f59e0b"],
  metrics: ["节目段落", "点火节点", "冲突提示", "安全距离"],
  filters: ["礼花弹", "罗马烛光", "扇形架", "冷焰火"],
  fields: ["烟花型号", "口径", "发射角度", "点火时间", "安全距离"],
};

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
  safetyDistance: string;
  remark: string;
}

const initialSegments: Segment[] = [
  {
    id: "seg-1",
    name: "序幕 Intro",
    type: "Intro",
    startTime: "00:00.000",
    endTime: "00:30.000",
    themeColor: "#1d4ed8",
    notes: "开场灯光秀配合冷焰火，营造神秘感",
  },
  {
    id: "seg-2",
    name: "高潮 Chorus A",
    type: "Chorus",
    startTime: "00:45.000",
    endTime: "01:30.000",
    themeColor: "#dc2626",
    notes: "主旋律高潮部分，礼花弹齐射",
  },
  {
    id: "seg-3",
    name: "终章 Finale",
    type: "Finale",
    startTime: "03:00.000",
    endTime: "03:45.000",
    themeColor: "#f59e0b",
    notes: "压轴大齐射，全场最壮观的部分",
  },
];

const initialRecords: FiringRecord[] = [
  {
    id: "rec-1",
    segmentId: "seg-1",
    model: "30mm扇形架",
    caliber: "30mm",
    angle: "45°",
    ignitionTime: "00:12.500",
    safetyDistance: "35m",
    remark: "安全距离35m",
  },
  {
    id: "rec-2",
    segmentId: "seg-2",
    model: "75mm礼花弹",
    caliber: "75mm",
    angle: "90°",
    ignitionTime: "01:08.200",
    safetyDistance: "80m",
    remark: "与B点位间隔正常",
  },
  {
    id: "rec-3",
    segmentId: "seg-3",
    model: "冷焰火",
    caliber: "-",
    angle: "60°",
    ignitionTime: "03:42.000",
    safetyDistance: "5m",
    remark: "近景区待确认",
  },
];

const segmentTypes: Segment["type"][] = [
  "Intro",
  "Chorus",
  "Bridge",
  "Finale",
  "Other",
];

const defaultColors = [
  "#1d4ed8",
  "#dc2626",
  "#f59e0b",
  "#059669",
  "#7c3aed",
  "#db2777",
];

function App() {
  const [segments, setSegments] = useState<Segment[]>(initialSegments);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    initialSegments[0]?.id ?? null
  );
  const [records, setRecords] = useState<FiringRecord[]>(initialRecords);
  const [formData, setFormData] = useState({
    segmentId: initialSegments[0]?.id ?? "",
    model: "",
    caliber: "",
    angle: "",
    ignitionTime: "",
    safetyDistance: "",
  });
  const [editingSegment, setEditingSegment] = useState<Segment | null>(
    initialSegments[0] ?? null
  );

  const selectedSegment = segments.find((s) => s.id === selectedSegmentId) || null;

  const getSegmentById = (id: string) => segments.find((s) => s.id === id);

  const handleAddSegment = () => {
    const newSegment: Segment = {
      id: `seg-${Date.now()}`,
      name: "新段落",
      type: "Other",
      startTime: "00:00.000",
      endTime: "00:10.000",
      themeColor: defaultColors[segments.length % defaultColors.length],
      notes: "",
    };
    setSegments([...segments, newSegment]);
    setSelectedSegmentId(newSegment.id);
    setEditingSegment(newSegment);
  };

  const handleDeleteSegment = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (segments.length <= 1) {
      alert("至少保留一个段落");
      return;
    }
    const newSegments = segments.filter((s) => s.id !== id);
    setSegments(newSegments);
    if (selectedSegmentId === id) {
      setSelectedSegmentId(newSegments[0]?.id ?? null);
      setEditingSegment(newSegments[0] ?? null);
    }
    setRecords(records.filter((r) => r.segmentId !== id));
  };

  const handleUpdateSegment = (updated: Segment) => {
    setSegments(
      segments.map((s) => (s.id === updated.id ? updated : s))
    );
    if (selectedSegmentId === updated.id) {
      setEditingSegment(updated);
    }
  };

  const handleSelectSegment = (id: string) => {
    setSelectedSegmentId(id);
    const seg = segments.find((s) => s.id === id);
    setEditingSegment(seg || null);
  };

  const handleFormChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSaveRecord = () => {
    if (!formData.segmentId || !formData.model) {
      alert("请至少填写段落和烟花型号");
      return;
    }
    const newRecord: FiringRecord = {
      id: `rec-${Date.now()}`,
      segmentId: formData.segmentId,
      model: formData.model,
      caliber: formData.caliber,
      angle: formData.angle,
      ignitionTime: formData.ignitionTime,
      safetyDistance: formData.safetyDistance,
      remark: "",
    };
    setRecords([...records, newRecord]);
    setFormData({
      segmentId: formData.segmentId,
      model: "",
      caliber: "",
      angle: "",
      ignitionTime: "",
      safetyDistance: "",
    });
  };

  const metricCounts = [segments.length, records.length, 7, 32];

  return (
    <main className="app">
      <section className="hero">
        <p>
          {project.id} · 源提示词{project.sourceNo} · Port {project.port}
        </p>
        <h1>{project.title}</h1>
        <span>{project.prompt}</span>
      </section>

      <section className="metrics">
        {project.metrics.map((metric: string, index: number) => (
          <article key={metric}>
            <small>{metric}</small>
            <strong>{metricCounts[index] ?? 12}</strong>
          </article>
        ))}
      </section>

      <section className="panel segment-manager">
        <div className="heading">
          <div>
            <p>节目结构</p>
            <h2>段落管理</h2>
          </div>
          <button className="primary" onClick={handleAddSegment}>
            + 新增段落
          </button>
        </div>

        <div className="segment-layout">
          <div className="segment-list">
            <h3>段落列表</h3>
            <div className="segment-items">
              {segments.map((segment) => (
                <article
                  key={segment.id}
                  className={`segment-item ${
                    selectedSegmentId === segment.id ? "active" : ""
                  }`}
                  onClick={() => handleSelectSegment(segment.id)}
                >
                  <div
                    className="segment-color-bar"
                    style={{ background: segment.themeColor }}
                  />
                  <div className="segment-info">
                    <div className="segment-header">
                      <span className="segment-type">{segment.type}</span>
                      <button
                        className="delete-btn"
                        onClick={(e) => handleDeleteSegment(segment.id, e)}
                        title="删除段落"
                      >
                        ×
                      </button>
                    </div>
                    <h4>{segment.name}</h4>
                    <p className="segment-time">
                      {segment.startTime} - {segment.endTime}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="segment-detail">
            <h3>段落详情</h3>
            {selectedSegment && editingSegment ? (
              <div className="segment-form">
                <label>
                  <span>段落名称</span>
                  <input
                    value={editingSegment.name}
                    onChange={(e) =>
                      setEditingSegment({
                        ...editingSegment,
                        name: e.target.value,
                      })
                    }
                    onBlur={() => handleUpdateSegment(editingSegment)}
                  />
                </label>

                <label>
                  <span>段落类型</span>
                  <select
                    value={editingSegment.type}
                    onChange={(e) =>
                      setEditingSegment({
                        ...editingSegment,
                        type: e.target.value as Segment["type"],
                      })
                    }
                    onBlur={() => handleUpdateSegment(editingSegment)}
                  >
                    {segmentTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="time-row">
                  <label>
                    <span>开始时间</span>
                    <input
                      value={editingSegment.startTime}
                      onChange={(e) =>
                        setEditingSegment({
                          ...editingSegment,
                          startTime: e.target.value,
                        })
                      }
                      onBlur={() => handleUpdateSegment(editingSegment)}
                      placeholder="00:00.000"
                    />
                  </label>
                  <label>
                    <span>结束时间</span>
                    <input
                      value={editingSegment.endTime}
                      onChange={(e) =>
                        setEditingSegment({
                          ...editingSegment,
                          endTime: e.target.value,
                        })
                      }
                      onBlur={() => handleUpdateSegment(editingSegment)}
                      placeholder="00:00.000"
                    />
                  </label>
                </div>

                <label>
                  <span>主题色</span>
                  <div className="color-picker-row">
                    <div className="color-presets">
                      {defaultColors.map((color) => (
                        <button
                          key={color}
                          className={`color-swatch ${
                            editingSegment.themeColor === color ? "active" : ""
                          }`}
                          style={{ background: color }}
                          onClick={() => {
                            const updated = { ...editingSegment, themeColor: color };
                            setEditingSegment(updated);
                            handleUpdateSegment(updated);
                          }}
                          title={color}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={editingSegment.themeColor}
                      onChange={(e) =>
                        setEditingSegment({
                          ...editingSegment,
                          themeColor: e.target.value,
                        })
                      }
                      onBlur={() => handleUpdateSegment(editingSegment)}
                      className="color-input"
                    />
                    <span className="color-hex">{editingSegment.themeColor}</span>
                  </div>
                </label>

                <label>
                  <span>备注</span>
                  <textarea
                    value={editingSegment.notes}
                    onChange={(e) =>
                      setEditingSegment({
                        ...editingSegment,
                        notes: e.target.value,
                      })
                    }
                    onBlur={() => handleUpdateSegment(editingSegment)}
                    placeholder="填写段落说明、编排思路、注意事项等..."
                    rows={4}
                  />
                </label>

                <div className="segment-stats">
                  <div className="stat-item">
                    <small>点火记录数</small>
                    <strong>
                      {records.filter((r) => r.segmentId === selectedSegment.id).length}
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>请选择一个段落查看详情</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="workspace">
        <aside className="panel">
          <h2>{project.domain}筛选</h2>
          <div className="chips">
            {project.filters.map((item: string) => (
              <button key={item}>{item}</button>
            ))}
          </div>
        </aside>

        <section className="panel form-panel">
          <div className="heading">
            <div>
              <p>专业字段</p>
              <h2>新增点火记录</h2>
            </div>
            <button className="primary" onClick={handleSaveRecord}>
              保存记录
            </button>
          </div>
          <div className="field-grid">
            <label className="field-full">
              <span>所属段落</span>
              <select
                value={formData.segmentId}
                onChange={(e) => handleFormChange("segmentId", e.target.value)}
              >
                <option value="">请选择段落</option>
                {segments.map((seg) => (
                  <option key={seg.id} value={seg.id}>
                    [{seg.type}] {seg.name}
                  </option>
                ))}
              </select>
            </label>
            {project.fields.map((field: string) => {
              const fieldMap: Record<string, string> = {
                烟花型号: "model",
                口径: "caliber",
                发射角度: "angle",
                点火时间: "ignitionTime",
                安全距离: "safetyDistance",
              };
              const key = fieldMap[field] || field;
              return (
                <label key={field}>
                  <span>{field}</span>
                  <input
                    placeholder={"填写" + field}
                    value={formData[key as keyof typeof formData] || ""}
                    onChange={(e) => handleFormChange(key, e.target.value)}
                  />
                </label>
              );
            })}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>历史记录</p>
            <h2>点火记录列表</h2>
          </div>
          <button>导出摘要</button>
        </div>
        <div className="records">
          {records.map((record: FiringRecord, index: number) => {
            const seg = getSegmentById(record.segmentId);
            return (
              <article key={record.id}>
                <b style={{ background: seg?.themeColor }}>
                  {String(index + 1).padStart(2, "0")}
                </b>
                <div>
                  <div className="record-header">
                    <h3>{record.model}</h3>
                    {seg && (
                      <span
                        className="record-segment-tag"
                        style={{
                          background: `${seg.themeColor}15`,
                          color: seg.themeColor,
                          borderColor: `${seg.themeColor}40`,
                        }}
                      >
                        {seg.type}
                      </span>
                    )}
                  </div>
                  <p>
                    {[
                      seg?.name,
                      record.caliber,
                      record.angle,
                      record.ignitionTime,
                      record.safetyDistance,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default App;
