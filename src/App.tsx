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
  fields: ["烟花型号", "口径", "发射角度", "点火时间", "持续时间", "安全距离"],
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
  duration: string;
  safetyDistance: string;
  remark: string;
}

type FireworkCategory = "礼花弹" | "罗马烛光" | "扇形架" | "冷焰火";

interface FireworkModel {
  id: string;
  name: string;
  category: FireworkCategory;
  caliber: string;
  defaultDuration: string;
  defaultSafetyDistance: string;
  applicablePositions: string;
}

interface Zone {
  id: string;
  name: "A区" | "B区" | "近景区" | "观众区";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface FiringPoint {
  id: string;
  name: string;
  zoneId: string;
  x: number;
  y: number;
  safetyDistance: number;
  assignedModel: string;
  notes: string;
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
    duration: "2.5s",
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
    duration: "3.0s",
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
    duration: "10.0s",
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

const fireworkCategories: FireworkCategory[] = [
  "礼花弹",
  "罗马烛光",
  "扇形架",
  "冷焰火",
];

const initialModels: FireworkModel[] = [
  {
    id: "mdl-1",
    name: "75mm礼花弹",
    category: "礼花弹",
    caliber: "75mm",
    defaultDuration: "3.0s",
    defaultSafetyDistance: "80m",
    applicablePositions: "A、B、C主阵地",
  },
  {
    id: "mdl-2",
    name: "100mm礼花弹",
    category: "礼花弹",
    caliber: "100mm",
    defaultDuration: "4.0s",
    defaultSafetyDistance: "120m",
    applicablePositions: "A、B主阵地",
  },
  {
    id: "mdl-3",
    name: "30mm扇形架",
    category: "扇形架",
    caliber: "30mm",
    defaultDuration: "2.5s",
    defaultSafetyDistance: "35m",
    applicablePositions: "D、E侧翼",
  },
  {
    id: "mdl-4",
    name: "50mm罗马烛光",
    category: "罗马烛光",
    caliber: "50mm",
    defaultDuration: "8.0s",
    defaultSafetyDistance: "30m",
    applicablePositions: "A、B、C、D全点位",
  },
  {
    id: "mdl-5",
    name: "冷焰火喷泉",
    category: "冷焰火",
    caliber: "-",
    defaultDuration: "10.0s",
    defaultSafetyDistance: "5m",
    applicablePositions: "舞台近景区",
  },
  {
    id: "mdl-6",
    name: "冷焰火瀑布",
    category: "冷焰火",
    caliber: "-",
    defaultDuration: "15.0s",
    defaultSafetyDistance: "3m",
    applicablePositions: "舞台顶部",
  },
];

const initialZones: Zone[] = [
  { id: "zone-a", name: "A区", x: 50, y: 80, width: 180, height: 120, color: "#dc2626" },
  { id: "zone-b", name: "B区", x: 270, y: 80, width: 180, height: 120, color: "#1d4ed8" },
  { id: "zone-near", name: "近景区", x: 120, y: 240, width: 260, height: 60, color: "#f59e0b" },
  { id: "zone-audience", name: "观众区", x: 50, y: 340, width: 400, height: 100, color: "#059669" },
];

const initialFiringPoints: FiringPoint[] = [
  { id: "fp-1", name: "A1", zoneId: "zone-a", x: 100, y: 120, safetyDistance: 80, assignedModel: "75mm礼花弹", notes: "主阵地左侧" },
  { id: "fp-2", name: "A2", zoneId: "zone-a", x: 180, y: 140, safetyDistance: 120, assignedModel: "100mm礼花弹", notes: "主阵地中央" },
  { id: "fp-3", name: "B1", zoneId: "zone-b", x: 320, y: 120, safetyDistance: 80, assignedModel: "75mm礼花弹", notes: "主阵地右侧" },
  { id: "fp-4", name: "B2", zoneId: "zone-b", x: 400, y: 140, safetyDistance: 30, assignedModel: "50mm罗马烛光", notes: "侧翼罗马烛光" },
  { id: "fp-5", name: "N1", zoneId: "zone-near", x: 180, y: 270, safetyDistance: 5, assignedModel: "冷焰火喷泉", notes: "近景舞台左侧" },
  { id: "fp-6", name: "N2", zoneId: "zone-near", x: 320, y: 270, safetyDistance: 3, assignedModel: "冷焰火瀑布", notes: "近景舞台右侧" },
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
    duration: "",
    safetyDistance: "",
  });
  const [editingSegment, setEditingSegment] = useState<Segment | null>(
    initialSegments[0] ?? null
  );
  const [models, setModels] = useState<FireworkModel[]>(initialModels);
  const [modelSearch, setModelSearch] = useState("");
  const [modelCategoryFilter, setModelCategoryFilter] = useState<FireworkCategory | "">("");
  const [showModelForm, setShowModelForm] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [newModel, setNewModel] = useState({
    name: "",
    category: "礼花弹" as FireworkCategory,
    caliber: "",
    defaultDuration: "",
    defaultSafetyDistance: "",
    applicablePositions: "",
  });
  const [modelFormErrors, setModelFormErrors] = useState<Record<string, string>>({});
  const [zones] = useState<Zone[]>(initialZones);
  const [firingPoints, setFiringPoints] = useState<FiringPoint[]>(initialFiringPoints);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const [showPointForm, setShowPointForm] = useState(false);
  const [editingPoint, setEditingPoint] = useState<FiringPoint | null>(null);
  const [newPoint, setNewPoint] = useState({
    name: "",
    zoneId: "zone-a",
    x: 250,
    y: 150,
    safetyDistance: 30,
    assignedModel: "",
    notes: "",
  });

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
      duration: formData.duration,
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
      duration: "",
      safetyDistance: "",
    });
  };

  const filteredModels = models.filter((m) => {
    const matchSearch = m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.applicablePositions.toLowerCase().includes(modelSearch.toLowerCase());
    const matchCategory = !modelCategoryFilter || m.category === modelCategoryFilter;
    return matchSearch && matchCategory;
  });

  const validateModelForm = () => {
    const errors: Record<string, string> = {};
    if (!newModel.name.trim()) errors.name = "型号名称不能为空";
    if (!newModel.caliber.trim()) errors.caliber = "口径不能为空";
    if (!newModel.defaultDuration.trim()) errors.defaultDuration = "默认持续时间不能为空";
    if (!newModel.defaultSafetyDistance.trim()) errors.defaultSafetyDistance = "默认安全距离不能为空";
    if (!newModel.applicablePositions.trim()) errors.applicablePositions = "适用点位不能为空";
    if (
      models.some(
        (m) => m.name === newModel.name.trim() && m.id !== editingModelId
      )
    )
      errors.name = "该型号名称已存在";
    setModelFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddModel = () => {
    if (!validateModelForm()) return;
    if (editingModelId) {
      setModels(
        models.map((m) =>
          m.id === editingModelId
            ? {
                ...m,
                name: newModel.name.trim(),
                category: newModel.category,
                caliber: newModel.caliber.trim(),
                defaultDuration: newModel.defaultDuration.trim(),
                defaultSafetyDistance: newModel.defaultSafetyDistance.trim(),
                applicablePositions: newModel.applicablePositions.trim(),
              }
            : m
        )
      );
      setEditingModelId(null);
    } else {
      const model: FireworkModel = {
        id: `mdl-${Date.now()}`,
        name: newModel.name.trim(),
        category: newModel.category,
        caliber: newModel.caliber.trim(),
        defaultDuration: newModel.defaultDuration.trim(),
        defaultSafetyDistance: newModel.defaultSafetyDistance.trim(),
        applicablePositions: newModel.applicablePositions.trim(),
      };
      setModels([...models, model]);
    }
    setNewModel({
      name: "",
      category: "礼花弹",
      caliber: "",
      defaultDuration: "",
      defaultSafetyDistance: "",
      applicablePositions: "",
    });
    setModelFormErrors({});
    setShowModelForm(false);
  };

  const handleEditModel = (id: string) => {
    const model = models.find((m) => m.id === id);
    if (model) {
      setNewModel({
        name: model.name,
        category: model.category,
        caliber: model.caliber,
        defaultDuration: model.defaultDuration,
        defaultSafetyDistance: model.defaultSafetyDistance,
        applicablePositions: model.applicablePositions,
      });
      setEditingModelId(id);
      setShowModelForm(true);
      setModelFormErrors({});
    }
  };

  const handleCancelModelForm = () => {
    setShowModelForm(false);
    setEditingModelId(null);
    setNewModel({
      name: "",
      category: "礼花弹",
      caliber: "",
      defaultDuration: "",
      defaultSafetyDistance: "",
      applicablePositions: "",
    });
    setModelFormErrors({});
  };

  const handleDeleteModel = (id: string) => {
    setModels(models.filter((m) => m.id !== id));
  };

  const handleSelectModelForRecord = (modelId: string) => {
    const selected = models.find((m) => m.id === modelId);
    if (selected) {
      setFormData({
        ...formData,
        model: selected.name,
        caliber: selected.caliber,
        duration: selected.defaultDuration,
        safetyDistance: selected.defaultSafetyDistance,
      });
    }
  };

  const getZoneById = (id: string) => zones.find((z) => z.id === id);
  const selectedPoint = firingPoints.find((p) => p.id === selectedPointId) || null;

  const handleAddPoint = () => {
    if (!newPoint.name.trim()) {
      alert("请填写点位名称");
      return;
    }
    const point: FiringPoint = {
      id: `fp-${Date.now()}`,
      name: newPoint.name.trim(),
      zoneId: newPoint.zoneId,
      x: newPoint.x,
      y: newPoint.y,
      safetyDistance: newPoint.safetyDistance,
      assignedModel: newPoint.assignedModel,
      notes: newPoint.notes,
    };
    setFiringPoints([...firingPoints, point]);
    setNewPoint({
      name: "",
      zoneId: "zone-a",
      x: 250,
      y: 150,
      safetyDistance: 30,
      assignedModel: "",
      notes: "",
    });
    setShowPointForm(false);
  };

  const handleDeletePoint = (id: string) => {
    setFiringPoints(firingPoints.filter((p) => p.id !== id));
    if (selectedPointId === id) {
      setSelectedPointId(null);
      setEditingPoint(null);
    }
  };

  const handleUpdatePoint = (updated: FiringPoint) => {
    setFiringPoints(
      firingPoints.map((p) => (p.id === updated.id ? updated : p))
    );
  };

  const handleSelectPoint = (id: string | null) => {
    setSelectedPointId(id);
    const point = firingPoints.find((p) => p.id === id);
    setEditingPoint(point || null);
  };

  const handlePointDragStart = (e: React.MouseEvent, pointId: string) => {
    e.preventDefault();
    setDraggingPointId(pointId);
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingPointId) return;
    const svg = e.currentTarget;
    const screenMatrix = svg.getScreenCTM();
    if (!screenMatrix) return;
    const svgPoint = svg.createSVGPoint();
    svgPoint.x = e.clientX;
    svgPoint.y = e.clientY;
    const { x, y } = svgPoint.matrixTransform(screenMatrix.inverse());
    const draggedPoint = firingPoints.find((p) => p.id === draggingPointId);
    const updatedPoint = draggedPoint ? { ...draggedPoint, x, y } : null;
    setFiringPoints(
      firingPoints.map((p) =>
        p.id === draggingPointId ? { ...p, x, y } : p
      )
    );
    if (updatedPoint && editingPoint?.id === draggingPointId) {
      setEditingPoint(updatedPoint);
    }
  };

  const handleSvgMouseUp = () => {
    if (draggingPointId) {
      setDraggingPointId(null);
    }
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as Element).tagName === "svg" || (e.target as Element).classList.contains("zone-rect")) {
      setSelectedPointId(null);
      setEditingPoint(null);
    }
  };

  const handleEditPointField = (field: keyof FiringPoint, value: string | number) => {
    if (editingPoint) {
      const updated = { ...editingPoint, [field]: value };
      setEditingPoint(updated);
      handleUpdatePoint(updated);
    }
  };

  const metricCounts = [segments.length, records.length, 7, firingPoints.length];

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

      <section className="panel model-catalog">
        <div className="heading">
          <div>
            <p>基础数据</p>
            <h2>烟花型号清单</h2>
          </div>
          <button
            className="primary"
            onClick={() => {
              if (showModelForm) {
                handleCancelModelForm();
              } else {
                setEditingModelId(null);
                setShowModelForm(true);
              }
            }}
          >
            {showModelForm ? "取消" : "+ 新增型号"}
          </button>
        </div>

        <div className="model-toolbar">
          <input
            className="model-search"
            placeholder="搜索型号名称或适用点位..."
            value={modelSearch}
            onChange={(e) => setModelSearch(e.target.value)}
          />
          <div className="chips model-chips">
            <button
              className={modelCategoryFilter === "" ? "active" : ""}
              onClick={() => setModelCategoryFilter("")}
            >
              全部
            </button>
            {fireworkCategories.map((cat) => (
              <button
                key={cat}
                className={modelCategoryFilter === cat ? "active" : ""}
                onClick={() => setModelCategoryFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {showModelForm && (
          <div className="model-form">
            <h3 style={{ marginBottom: 14, color: "#475569" }}>
              {editingModelId ? "编辑型号" : "新增型号"}
            </h3>
            <div className="field-grid">
              <label>
                <span>型号名称 *</span>
                <input
                  placeholder="例如：75mm礼花弹"
                  value={newModel.name}
                  onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                />
                {modelFormErrors.name && (
                  <span className="field-error">{modelFormErrors.name}</span>
                )}
              </label>
              <label>
                <span>分类 *</span>
                <select
                  value={newModel.category}
                  onChange={(e) =>
                    setNewModel({ ...newModel, category: e.target.value as FireworkCategory })
                  }
                >
                  {fireworkCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>口径 *</span>
                <input
                  placeholder="例如：75mm"
                  value={newModel.caliber}
                  onChange={(e) => setNewModel({ ...newModel, caliber: e.target.value })}
                />
                {modelFormErrors.caliber && (
                  <span className="field-error">{modelFormErrors.caliber}</span>
                )}
              </label>
              <label>
                <span>默认持续时间 *</span>
                <input
                  placeholder="例如：3.0s"
                  value={newModel.defaultDuration}
                  onChange={(e) => setNewModel({ ...newModel, defaultDuration: e.target.value })}
                />
                {modelFormErrors.defaultDuration && (
                  <span className="field-error">{modelFormErrors.defaultDuration}</span>
                )}
              </label>
              <label>
                <span>默认安全距离 *</span>
                <input
                  placeholder="例如：80m"
                  value={newModel.defaultSafetyDistance}
                  onChange={(e) =>
                    setNewModel({ ...newModel, defaultSafetyDistance: e.target.value })
                  }
                />
                {modelFormErrors.defaultSafetyDistance && (
                  <span className="field-error">{modelFormErrors.defaultSafetyDistance}</span>
                )}
              </label>
              <label>
                <span>适用点位 *</span>
                <input
                  placeholder="例如：A、B主阵地"
                  value={newModel.applicablePositions}
                  onChange={(e) =>
                    setNewModel({ ...newModel, applicablePositions: e.target.value })
                  }
                />
                {modelFormErrors.applicablePositions && (
                  <span className="field-error">{modelFormErrors.applicablePositions}</span>
                )}
              </label>
            </div>
            <div className="model-form-actions">
              <button onClick={handleCancelModelForm}>取消</button>
              <button className="primary" onClick={handleAddModel}>
                {editingModelId ? "保存修改" : "确认新增"}
              </button>
            </div>
          </div>
        )}

        <div className="model-list">
          {filteredModels.length > 0 ? (
            filteredModels.map((m) => (
              <article key={m.id} className="model-item">
                <div className="model-item-main">
                  <div className="model-item-header">
                    <h3>{m.name}</h3>
                    <span className={`model-category-tag tag-${m.category}`}>
                      {m.category}
                    </span>
                  </div>
                  <p>
                    口径 {m.caliber} · 持续 {m.defaultDuration} · 安全距离 {m.defaultSafetyDistance} · 点位 {m.applicablePositions}
                  </p>
                </div>
                <div className="model-item-actions">
                  <button
                    className="edit-btn"
                    onClick={() => handleEditModel(m.id)}
                    title="编辑型号"
                  >
                    编辑
                  </button>
                  <button
                    className="delete-btn"
                    onClick={() => handleDeleteModel(m.id)}
                    title="删除型号"
                  >
                    ×
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <p>暂无匹配的型号数据</p>
            </div>
          )}
        </div>
      </section>

      <section className="panel firing-plan-panel">
        <div className="heading">
          <div>
            <p>场地布局</p>
            <h2>燃放点位平面图</h2>
          </div>
          <button
            className="primary"
            onClick={() => {
              if (showPointForm) {
                setShowPointForm(false);
              } else {
                setShowPointForm(true);
              }
            }}
          >
            {showPointForm ? "取消" : "+ 新增点位"}
          </button>
        </div>

        <div className="zone-legend">
          {zones.map((zone) => (
            <div key={zone.id} className="legend-item">
              <span
                className="legend-color"
                style={{ background: zone.color }}
              />
              <span className="legend-text">{zone.name}</span>
            </div>
          ))}
        </div>

        {showPointForm && (
          <div className="point-form">
            <h3 style={{ marginBottom: 14, color: "#475569" }}>新增点位</h3>
            <div className="field-grid">
              <label>
                <span>点位名称 *</span>
                <input
                  placeholder="例如：A3"
                  value={newPoint.name}
                  onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })}
                />
              </label>
              <label>
                <span>所属区域</span>
                <select
                  value={newPoint.zoneId}
                  onChange={(e) => setNewPoint({ ...newPoint, zoneId: e.target.value })}
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>X 坐标</span>
                <input
                  type="number"
                  value={newPoint.x}
                  onChange={(e) => setNewPoint({ ...newPoint, x: Number(e.target.value) })}
                />
              </label>
              <label>
                <span>Y 坐标</span>
                <input
                  type="number"
                  value={newPoint.y}
                  onChange={(e) => setNewPoint({ ...newPoint, y: Number(e.target.value) })}
                />
              </label>
              <label>
                <span>安全距离 (m)</span>
                <input
                  type="number"
                  value={newPoint.safetyDistance}
                  onChange={(e) => setNewPoint({ ...newPoint, safetyDistance: Number(e.target.value) })}
                />
              </label>
              <label>
                <span>指定型号</span>
                <select
                  value={newPoint.assignedModel}
                  onChange={(e) => setNewPoint({ ...newPoint, assignedModel: e.target.value })}
                >
                  <option value="">未指定</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </label>
              <label className="field-full">
                <span>备注</span>
                <input
                  placeholder="点位说明..."
                  value={newPoint.notes}
                  onChange={(e) => setNewPoint({ ...newPoint, notes: e.target.value })}
                />
              </label>
            </div>
            <div className="model-form-actions">
              <button onClick={() => setShowPointForm(false)}>取消</button>
              <button className="primary" onClick={handleAddPoint}>确认新增</button>
            </div>
          </div>
        )}

        <div className="plan-layout">
          <div className="plan-canvas">
            <svg
              viewBox="0 0 500 480"
              className="plan-svg"
              onMouseMove={handleSvgMouseMove}
              onMouseUp={handleSvgMouseUp}
              onMouseLeave={handleSvgMouseUp}
              onClick={handleSvgClick}
            >
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {zones.map((zone) => (
                <g key={zone.id}>
                  <rect
                    className="zone-rect"
                    x={zone.x}
                    y={zone.y}
                    width={zone.width}
                    height={zone.height}
                    fill={zone.color}
                    fillOpacity="0.12"
                    stroke={zone.color}
                    strokeWidth="2"
                    strokeDasharray="6 3"
                    rx="6"
                  />
                  <text
                    x={zone.x + zone.width / 2}
                    y={zone.y + 24}
                    textAnchor="middle"
                    fill={zone.color}
                    fontSize="14"
                    fontWeight="700"
                    style={{ userSelect: "none" }}
                  >
                    {zone.name}
                  </text>
                </g>
              ))}

              {firingPoints.map((point) => {
                const zone = getZoneById(point.zoneId);
                const isSelected = selectedPointId === point.id;
                const isDragging = draggingPointId === point.id;
                const safetyRadius = point.safetyDistance * 0.8;

                return (
                  <g key={point.id}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={safetyRadius}
                      fill={zone?.color || "#64748b"}
                      fillOpacity="0.15"
                      stroke={zone?.color || "#64748b"}
                      strokeWidth="1"
                      strokeDasharray="4 2"
                      style={{ pointerEvents: "none" }}
                    />
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={14}
                      fill={zone?.color || "#64748b"}
                      stroke={isSelected ? "#172033" : "#ffffff"}
                      strokeWidth={isSelected ? 3 : 2}
                      style={{
                        cursor: "grab",
                        filter: isDragging ? "drop-shadow(0 4px 8px rgba(0,0,0,0.3))" : "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                        transition: "filter 0.15s ease",
                      }}
                      onMouseDown={(e) => handlePointDragStart(e, point.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPoint(point.id);
                      }}
                    />
                    <text
                      x={point.x}
                      y={point.y + 4}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="700"
                      style={{
                        userSelect: "none",
                        pointerEvents: "none",
                      }}
                    >
                      {point.name}
                    </text>
                    <text
                      x={point.x}
                      y={point.y + 30}
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="10"
                      style={{
                        userSelect: "none",
                        pointerEvents: "none",
                      }}
                    >
                      {point.safetyDistance}m
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="point-detail-panel">
            <h3>点位详情</h3>
            {selectedPoint && editingPoint ? (
              <div className="point-detail">
                <div
                  className="point-detail-header"
                  style={{
                    borderLeftColor: getZoneById(selectedPoint.zoneId)?.color,
                  }}
                >
                  <div>
                    <h4>点位 {selectedPoint.name}</h4>
                    <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
                      {getZoneById(selectedPoint.zoneId)?.name}
                    </p>
                  </div>
                  <button
                    className="delete-btn"
                    onClick={() => handleDeletePoint(selectedPoint.id)}
                    title="删除点位"
                    style={{ width: 28, height: 28, fontSize: 20 }}
                  >
                    ×
                  </button>
                </div>

                <div className="point-coords">
                  <div className="coord-item">
                    <small>X 坐标</small>
                    <strong>{Math.round(selectedPoint.x)}</strong>
                  </div>
                  <div className="coord-item">
                    <small>Y 坐标</small>
                    <strong>{Math.round(selectedPoint.y)}</strong>
                  </div>
                  <div className="coord-item">
                    <small>安全距离</small>
                    <strong>{selectedPoint.safetyDistance}m</strong>
                  </div>
                </div>

                <div className="point-form-fields">
                  <label>
                    <span>点位名称</span>
                    <input
                      value={editingPoint.name}
                      onChange={(e) => handleEditPointField("name", e.target.value)}
                    />
                  </label>
                  <label>
                    <span>所属区域</span>
                    <select
                      value={editingPoint.zoneId}
                      onChange={(e) => handleEditPointField("zoneId", e.target.value)}
                    >
                      {zones.map((z) => (
                        <option key={z.id} value={z.id}>{z.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>X 坐标</span>
                    <input
                      type="number"
                      value={editingPoint.x}
                      onChange={(e) => handleEditPointField("x", Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <span>Y 坐标</span>
                    <input
                      type="number"
                      value={editingPoint.y}
                      onChange={(e) => handleEditPointField("y", Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <span>安全距离 (m)</span>
                    <input
                      type="number"
                      value={editingPoint.safetyDistance}
                      onChange={(e) => handleEditPointField("safetyDistance", Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <span>指定型号</span>
                    <select
                      value={editingPoint.assignedModel}
                      onChange={(e) => handleEditPointField("assignedModel", e.target.value)}
                    >
                      <option value="">未指定</option>
                      {models.map((m) => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field-full">
                    <span>备注</span>
                    <textarea
                      value={editingPoint.notes}
                      onChange={(e) => handleEditPointField("notes", e.target.value)}
                      rows={2}
                      placeholder="点位说明..."
                    />
                  </label>
                </div>

                <div className="point-info">
                  <small style={{ color: "#64748b" }}>提示：可直接拖拽点位调整坐标</small>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>点击平面图上的点位查看详情</p>
              </div>
            )}

            <div className="point-list-mini">
              <h4>点位列表</h4>
              <div className="point-list-items">
                {firingPoints.map((point) => (
                  <div
                    key={point.id}
                    className={`point-list-item ${
                      selectedPointId === point.id ? "active" : ""
                    }`}
                    onClick={() => handleSelectPoint(point.id)}
                  >
                    <span
                      className="point-dot"
                      style={{ background: getZoneById(point.zoneId)?.color }}
                    />
                    <span className="point-list-name">{point.name}</span>
                    <span className="point-list-zone">
                      {getZoneById(point.zoneId)?.name}
                    </span>
                    <span className="point-list-dist">
                      {point.safetyDistance}m
                    </span>
                  </div>
                ))}
              </div>
            </div>
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
            <label className="field-full">
              <span>选择型号（从型号清单）</span>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) handleSelectModelForRecord(e.target.value);
                }}
              >
                <option value="">点击选择型号自动回填</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    [{m.category}] {m.name} — 口径{m.caliber} 安全{m.defaultSafetyDistance}
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
                持续时间: "duration",
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
                      record.duration ? `持续${record.duration}` : null,
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
