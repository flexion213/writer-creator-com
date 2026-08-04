import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Upload, Brush, Eraser, Route as RouteIcon, PaintBucket, Trash2,
  Download, Tag, X, Menu, ImageOff, Layers as LayersIcon, Type as TypeIcon,
  Eye, EyeOff, ChevronUp, ChevronDown, Plus,
} from "lucide-react";

type MarkerType = "Safehouse" | "Enemy Territory" | "Objective" | "Resource Stash" | "Custom Label";
type Marker = { id: string; type: MarkerType; label: string; x: number; y: number; layerId: string };
type Tool = "brush" | "eraser" | "route" | "bucket" | "text" | "move";
type Pt = { x: number; y: number };
type RoutePath = { id: string; pts: Pt[]; color: string; width: number; layerId: string };
type TextLabel = { id: string; text: string; x: number; y: number; size: number; color: string; layerId: string };
type LayerKind = "bg" | "ink" | "vector";
type Layer = { id: string; name: string; visible: boolean; kind: LayerKind };

// Build a smooth Catmull-Rom -> cubic bezier path so hand-drawn routes render
// as slick vector curves instead of jagged polylines.
function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

// Marker style: each type is a glowing dot in a signature color.
const MARKER_META: Record<MarkerType, { color: string }> = {
  "Safehouse":        { color: "#10b981" },
  "Enemy Territory":  { color: "#ef4444" },
  "Objective":        { color: "#f59e0b" },
  "Resource Stash":   { color: "#3b82f6" },
  "Custom Label":     { color: "#a855f7" },
};

const LS = {
  bg: "ts:bg",
  canvas: "ts:canvas",
  markers: "ts:markers",
  tool: "ts:tool",
  color: "ts:color",
  size: "ts:size",
  routes: "ts:routes",
  texts: "ts:texts",
  layers: "ts:layers",
  activeLayer: "ts:activeLayer",
};

const BG_LAYER = "layer-bg";
const INK_LAYER = "layer-ink";
const TROOPS_LAYER = "layer-troops";
const ROUTES_LAYER = "layer-routes";

// Layers are ordered bottom -> top.
const DEFAULT_LAYERS: Layer[] = [
  { id: BG_LAYER,     name: "Background Map",   visible: true, kind: "bg" },
  { id: INK_LAYER,    name: "Sketch Ink",       visible: true, kind: "ink" },
  { id: TROOPS_LAYER, name: "Troop Placements", visible: true, kind: "vector" },
  { id: ROUTES_LAYER, name: "Route Arrows",     visible: true, kind: "vector" },
];

export function TacticalSandbox({ onOpenMenu }: { onOpenMenu: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [bg, setBg] = useState<string | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState<string>("#22c55e");
  const [size, setSize] = useState<number>(8);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<RoutePath[]>([]);
  const [texts, setTexts] = useState<TextLabel[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [layers, setLayers] = useState<Layer[]>(DEFAULT_LAYERS);
  const [activeLayerId, setActiveLayerId] = useState<string>(TROOPS_LAYER);
  const [draftRoute, setDraftRoute] = useState<Pt[] | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  // Route strokes are captured as vector points (wrap-relative CSS coords).
  const routePts = useRef<Array<{ x: number; y: number }>>([]);
  const draggingMarker = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const draggingVertex = useRef<{ routeId: string; index: number } | null>(null);
  const draggingText = useRef<{ id: string; dx: number; dy: number } | null>(null);

  // Hydrate
  useEffect(() => {
    try {
      const rawBg = localStorage.getItem(LS.bg);
      const rawM = localStorage.getItem(LS.markers);
      const rawT = localStorage.getItem(LS.tool);
      const rawC = localStorage.getItem(LS.color);
      const rawS = localStorage.getItem(LS.size);
      if (rawBg) setBg(rawBg);
      if (rawT) setTool(rawT as Tool);
      if (rawC) setColor(rawC);
      if (rawS) setSize(Number(rawS) || 8);

      const rawL = localStorage.getItem(LS.layers);
      let loaded = DEFAULT_LAYERS;
      if (rawL) {
        const parsed = JSON.parse(rawL);
        if (Array.isArray(parsed) && parsed.length) loaded = parsed;
      }
      setLayers(loaded);
      const rawAL = localStorage.getItem(LS.activeLayer);
      const validActive = loaded.find((l) => l.id === rawAL && l.kind === "vector");
      setActiveLayerId(validActive ? validActive.id : (loaded.find((l) => l.kind === "vector")?.id ?? TROOPS_LAYER));

      const fallbackVector = loaded.find((l) => l.kind === "vector")?.id ?? TROOPS_LAYER;
      if (rawM) {
        const parsed: Marker[] = JSON.parse(rawM);
        setMarkers(parsed.map((m) => ({ ...m, layerId: m.layerId && loaded.some((l) => l.id === m.layerId) ? m.layerId : TROOPS_LAYER })));
      }
      const rawR = localStorage.getItem(LS.routes);
      if (rawR) {
        const parsed: RoutePath[] = JSON.parse(rawR);
        setRoutes(parsed.map((r) => ({ ...r, layerId: r.layerId && loaded.some((l) => l.id === r.layerId) ? r.layerId : ROUTES_LAYER })));
      }
      const rawTx = localStorage.getItem(LS.texts);
      if (rawTx) {
        const parsed: TextLabel[] = JSON.parse(rawTx);
        setTexts(parsed.map((t) => ({ ...t, layerId: t.layerId && loaded.some((l) => l.id === t.layerId) ? t.layerId : fallbackVector })));
      }
    } catch {}
    setHydrated(true);
  }, []);

  // Persist prefs
  useEffect(() => { if (hydrated) try { localStorage.setItem(LS.tool, tool); } catch {} }, [tool, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(LS.color, color); } catch {} }, [color, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(LS.size, String(size)); } catch {} }, [size, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(LS.markers, JSON.stringify(markers)); } catch {} }, [markers, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(LS.routes, JSON.stringify(routes)); } catch {} }, [routes, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(LS.texts, JSON.stringify(texts)); } catch {} }, [texts, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(LS.layers, JSON.stringify(layers)); } catch {} }, [layers, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(LS.activeLayer, activeLayerId); } catch {} }, [activeLayerId, hydrated]);

  // Init canvas + restore saved drawing
  useEffect(() => {
    if (!hydrated) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    canvas.width = Math.max(320, Math.floor(rect.width));
    canvas.height = Math.max(400, Math.floor(rect.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
    const saved = localStorage.getItem(LS.canvas);
    if (saved) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = saved;
    }
  }, [hydrated]);

  const persistCanvas = useCallback(() => {
    try {
      const c = canvasRef.current;
      if (!c) return;
      localStorage.setItem(LS.canvas, c.toDataURL("image/png"));
    } catch {}
  }, []);

  const layerIndex = (id: string) => {
    const i = layers.findIndex((l) => l.id === id);
    return i < 0 ? 0 : i;
  };
  const layerVisible = (id: string) => layers.find((l) => l.id === id)?.visible ?? true;
  const zFor = (id: string) => (layerIndex(id) + 1) * 10;
  const inkLayer = layers.find((l) => l.kind === "ink");
  const bgLayer = layers.find((l) => l.kind === "bg");
  const inkVisible = inkLayer?.visible ?? true;

  const getPt = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * c.width) / r.width,
      y: ((e.clientY - r.top) * c.height) / r.height,
    };
  };

  // Wrap-relative CSS coordinates, used for vector routes, texts and markers.
  const getWrapPt = (e: React.PointerEvent): Pt => {
    const wrap = wrapRef.current!;
    const r = wrap.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // Flood fill implementation
  const floodFill = (sx: number, sy: number, hex: string) => {
    const c = canvasRef.current!;
    const ctx = ctxRef.current!;
    const w = c.width, h = c.height;
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    const idx = (x: number, y: number) => (y * w + x) * 4;
    const sx0 = Math.floor(sx), sy0 = Math.floor(sy);
    if (sx0 < 0 || sy0 < 0 || sx0 >= w || sy0 >= h) return;
    const start = idx(sx0, sy0);
    const tr = data[start], tg = data[start + 1], tb = data[start + 2], ta = data[start + 3];
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    if (tr === r && tg === g && tb === b && ta === 255) return;
    const tol = 24;
    const stack: number[] = [sx0, sy0];
    while (stack.length) {
      const y = stack.pop()!, x = stack.pop()!;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const p = idx(x, y);
      const dr = data[p] - tr, dg = data[p + 1] - tg, db = data[p + 2] - tb, da = data[p + 3] - ta;
      if (dr * dr + dg * dg + db * db + da * da > tol * tol * 4) continue;
      if (data[p] === r && data[p + 1] === g && data[p + 2] === b && data[p + 3] === 255) continue;
      data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = 255;
      stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
    ctx.putImageData(img, 0, 0);
    persistCanvas();
  };

  const addTextAt = (wp: Pt) => {
    const id = crypto.randomUUID();
    setTexts((t) => [...t, {
      id, text: "New label", x: wp.x, y: wp.y,
      size: 18, color, layerId: activeLayerId,
    }]);
    setSelectedTextId(id);
    setEditingTextId(id);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (tool === "move") return;
    if (tool === "text") { addTextAt(getWrapPt(e)); return; }
    // Ink tools require a visible ink layer.
    if ((tool === "brush" || tool === "eraser" || tool === "bucket") && !inkVisible) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = getPt(e);
    if (tool === "bucket") { floodFill(p.x, p.y, color); return; }
    if (tool === "route") {
      if (!layerVisible(activeLayerId)) return;
      drawing.current = true;
      const wp = getWrapPt(e);
      routePts.current = [wp];
      setDraftRoute([wp]);
      setSelectedRouteId(null);
      return;
    }
    const ctx = ctxRef.current!;
    drawing.current = true;
    lastPt.current = p;
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    if (tool === "route") {
      const wp = getWrapPt(e);
      const pts = routePts.current;
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(wp.x - last.x, wp.y - last.y) > 6) {
        pts.push(wp);
        setDraftRoute([...pts]);
      }
      return;
    }
    const ctx = ctxRef.current!;
    const p = getPt(e);
    const from = lastPt.current!;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPt.current = p;
  };
  const onPointerUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    lastPt.current = null;
    // Route strokes become interactive vector arrows instead of raster ink.
    if (tool === "route") {
      const pts = routePts.current;
      routePts.current = [];
      setDraftRoute(null);
      if (pts.length >= 2) {
        const id = crypto.randomUUID();
        setRoutes((r) => [...r, { id, pts, color, width: Math.max(3, size / 2), layerId: activeLayerId }]);
        setSelectedRouteId(id);
      }
      return;
    }
    persistCanvas();
  };

  const clearAll = () => {
    if (!confirm("Clear the entire canvas (including routes, labels and markers)?")) return;
    const c = canvasRef.current!, ctx = ctxRef.current!;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, c.width, c.height);
    setRoutes([]);
    setTexts([]);
    setMarkers([]);
    setSelectedRouteId(null);
    setSelectedTextId(null);
    persistCanvas();
  };

  const onUploadMap = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      setBg(data);
      try { localStorage.setItem(LS.bg, data); } catch (err) { console.warn("bg too large", err); }
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  };
  const removeBg = () => { setBg(null); try { localStorage.removeItem(LS.bg); } catch {} };

  // ---- Layer management ----
  const addLayer = () => {
    const id = crypto.randomUUID();
    setLayers((l) => [...l, { id, name: `Layer ${l.length + 1}`, visible: true, kind: "vector" }]);
    setActiveLayerId(id);
  };
  const toggleLayer = (id: string) =>
    setLayers((l) => l.map((x) => (x.id === id ? { ...x, visible: !x.visible } : x)));
  const renameLayer = (id: string, name: string) =>
    setLayers((l) => l.map((x) => (x.id === id ? { ...x, name } : x)));
  const deleteLayer = (id: string) => {
    const target = layers.find((x) => x.id === id);
    if (!target || target.kind !== "vector") return;
    if (layers.filter((x) => x.kind === "vector").length <= 1) {
      alert("Keep at least one element layer.");
      return;
    }
    if (!confirm(`Delete "${target.name}" and everything on it?`)) return;
    setRoutes((r) => r.filter((x) => x.layerId !== id));
    setTexts((t) => t.filter((x) => x.layerId !== id));
    setMarkers((m) => m.filter((x) => x.layerId !== id));
    setLayers((l) => {
      const next = l.filter((x) => x.id !== id);
      setActiveLayerId((cur) => (cur === id ? (next.find((x) => x.kind === "vector")?.id ?? next[0].id) : cur));
      return next;
    });
  };
  const moveLayer = (id: string, dir: -1 | 1) => {
    setLayers((l) => {
      const i = l.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= l.length) return l;
      const next = [...l];
      const tmp = next[i];
      next[i] = next[j];
      next[j] = tmp;
      return next;
    });
  };

  // Marker helpers
  const addMarker = (type: MarkerType) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    setMarkers((m) => [...m, {
      id: crypto.randomUUID(), type, label: type,
      x: r.width / 2, y: r.height / 2, layerId: activeLayerId,
    }]);
    setSidebarOpen(false);
  };
  const removeMarker = (id: string) => setMarkers((m) => m.filter((x) => x.id !== id));
  const renameMarker = (id: string, label: string) => setMarkers((m) => m.map((x) => x.id === id ? { ...x, label } : x));

  // ---- Text label editing ----
  const updateText = (id: string, patch: Partial<TextLabel>) =>
    setTexts((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeText = (id: string) => {
    setTexts((t) => t.filter((x) => x.id !== id));
    setSelectedTextId((s) => (s === id ? null : s));
    setEditingTextId((s) => (s === id ? null : s));
  };
  const onTextPointerDown = (e: React.PointerEvent, t: TextLabel) => {
    e.stopPropagation();
    setSelectedTextId(t.id);
    if (editingTextId === t.id) return;
    const wrap = wrapRef.current!;
    const r = wrap.getBoundingClientRect();
    draggingText.current = { id: t.id, dx: e.clientX - r.left - t.x, dy: e.clientY - r.top - t.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  // ---- Vector route editing ----
  const removeRoute = (id: string) => {
    setRoutes((r) => r.filter((x) => x.id !== id));
    setSelectedRouteId((s) => (s === id ? null : s));
  };
  const recolorRoute = (id: string, hex: string) =>
    setRoutes((r) => r.map((x) => (x.id === id ? { ...x, color: hex } : x)));
  const resizeRoute = (id: string, delta: number) =>
    setRoutes((r) => r.map((x) => (x.id === id ? { ...x, width: Math.max(2, Math.min(40, x.width + delta)) } : x)));
  const onVertexDown = (e: React.PointerEvent, routeId: string, index: number) => {
    e.stopPropagation();
    draggingVertex.current = { routeId, index };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onVertexMove = (e: React.PointerEvent) => {
    const d = draggingVertex.current;
    if (!d) return;
    const wp = getWrapPt(e);
    setRoutes((all) =>
      all.map((r) =>
        r.id === d.routeId
          ? { ...r, pts: r.pts.map((p, i) => (i === d.index ? wp : p)) }
          : r,
      ),
    );
  };
  const onVertexUp = () => { draggingVertex.current = null; };

  const onMarkerPointerDown = (e: React.PointerEvent, m: Marker) => {
    e.stopPropagation();
    const wrap = wrapRef.current!;
    const r = wrap.getBoundingClientRect();
    draggingMarker.current = { id: m.id, dx: e.clientX - r.left - m.x, dy: e.clientY - r.top - m.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onSurfacePointerMove = (e: React.PointerEvent) => {
    onVertexMove(e);
    const wrap = wrapRef.current!;
    const r = wrap.getBoundingClientRect();
    const dt = draggingText.current;
    if (dt) {
      const nx = Math.max(0, Math.min(r.width, e.clientX - r.left - dt.dx));
      const ny = Math.max(0, Math.min(r.height, e.clientY - r.top - dt.dy));
      setTexts((all) => all.map((x) => (x.id === dt.id ? { ...x, x: nx, y: ny } : x)));
    }
    const d = draggingMarker.current;
    if (!d) return;
    const nx = Math.max(0, Math.min(r.width, e.clientX - r.left - d.dx));
    const ny = Math.max(0, Math.min(r.height, e.clientY - r.top - d.dy));
    setMarkers((all) => all.map((x) => x.id === d.id ? { ...x, x: nx, y: ny } : x));
  };
  const onSurfacePointerUp = () => {
    draggingMarker.current = null;
    draggingText.current = null;
    onVertexUp();
  };

  const exportPng = () => {
    const c = canvasRef.current;
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = "tactical-sandbox.png";
    a.click();
  };

  const TOOLS: { id: Tool; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "brush",  label: "Brush",       icon: Brush },
    { id: "route",  label: "Route",       icon: RouteIcon },
    { id: "text",   label: "Text",        icon: TypeIcon },
    { id: "bucket", label: "Paint bucket", icon: PaintBucket },
    { id: "eraser", label: "Eraser",      icon: Eraser },
    { id: "move",   label: "Move",        icon: Menu },
  ];

  const PRESET_COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#a855f7", "#e11d48", "#ffffff", "#0f172a"];
  const vectorLayers = layers.filter((l) => l.kind === "vector");
  const activeLayerName = layers.find((l) => l.id === activeLayerId)?.name ?? "—";
  const selectedText = texts.find((t) => t.id === selectedTextId) ?? null;

  return (
    <div className="fixed inset-0 flex flex-col bg-background text-foreground">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 glass-panel">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onOpenMenu} aria-label="Menu">
          <div className="flex flex-col gap-[5px]">
            <span className="block h-[2px] w-5 bg-foreground" />
            <span className="block h-[2px] w-5 bg-foreground" />
            <span className="block h-[2px] w-5 bg-foreground" />
          </div>
        </Button>
        <h1 className="text-sm font-semibold tracking-tight flex-1 truncate">Tactical Sandbox</h1>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => { setLayersOpen((s) => !s); setSidebarOpen(false); }}>
          <LayersIcon className="h-3.5 w-3.5 mr-1" /> Layers
        </Button>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => { setSidebarOpen((s) => !s); setLayersOpen(false); }}>
          <Tag className="h-3.5 w-3.5 mr-1" /> Markers
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-border/60 bg-card/40">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const active = tool === t.id;
          return (
            <Button
              key={t.id}
              size="sm"
              variant={active ? "default" : "outline"}
              className={`h-8 rounded-full ${active ? "tool-glow" : ""}`}
              onClick={() => setTool(t.id)}
              title={t.label}
            >
              <Icon className="h-3.5 w-3.5 mr-1" /> {t.label}
            </Button>
          );
        })}
        <div className="mx-1 h-6 w-px bg-border" />
        <div className="flex items-center gap-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border ${color === c ? "ring-2 ring-primary" : "border-border/50"}`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="color-picker-round"
            aria-label="Custom color"
          />
        </div>
        <div className="mx-1 h-6 w-px bg-border" />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Size
          <input
            type="range" min={1} max={200} value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-28 accent-primary"
          />
          <span className="tabular-nums w-8 text-right">{size}</span>
        </label>
        <div className="mx-1 h-6 w-px bg-border" />
        <span className="text-[11px] text-muted-foreground">
          Active layer: <span className="text-foreground font-medium">{activeLayerName}</span>
        </span>
        <div className="mx-1 h-6 w-px bg-border" />
        <label className="inline-flex">
          <input type="file" accept="image/*" className="hidden" onChange={onUploadMap} />
          <span className="inline-flex items-center h-8 rounded-full border border-border/60 px-3 text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground">
            <Upload className="h-3.5 w-3.5 mr-1" /> Upload map
          </span>
        </label>
        {bg && (
          <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={removeBg}>
            <ImageOff className="h-3.5 w-3.5 mr-1" /> Remove bg
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={exportPng}>
          <Download className="h-3.5 w-3.5 mr-1" /> Export
        </Button>
        <Button size="sm" variant="destructive" className="h-8 rounded-full" onClick={clearAll}>
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
        </Button>
      </div>

      {/* Canvas + markers */}
      <div className="flex-1 relative overflow-hidden">
        <div
          ref={wrapRef}
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.04),transparent_60%)]"
          onPointerMove={onSurfacePointerMove}
          onPointerUp={onSurfacePointerUp}
        >
          {bg && (bgLayer?.visible ?? true) && (
            <img
              src={bg}
              alt="Map background"
              className="absolute inset-0 h-full w-full object-contain pointer-events-none select-none"
              draggable={false}
              style={{ zIndex: zFor(bgLayer?.id ?? BG_LAYER) }}
            />
          )}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            style={{
              cursor: tool === "move" ? "default" : "crosshair",
              zIndex: zFor(inkLayer?.id ?? INK_LAYER),
              opacity: inkVisible ? 1 : 0,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />

          {/* Per-layer vector content: routes, text labels, markers */}
          {vectorLayers.filter((l) => l.visible).map((layer) => {
            const layerRoutes = routes.filter((r) => r.layerId === layer.id);
            const layerTexts = texts.filter((t) => t.layerId === layer.id);
            const layerMarkers = markers.filter((m) => m.layerId === layer.id);
            const isActive = layer.id === activeLayerId;
            const showDraft = isActive && draftRoute && draftRoute.length > 1;
            return (
              <div key={layer.id} className="absolute inset-0" style={{ zIndex: zFor(layer.id), pointerEvents: "none" }}>
                {/* Vector route arrows */}
                <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none", overflow: "visible" }}>
                  <defs>
                    {[...layerRoutes, ...(showDraft ? [{ id: `draft-${layer.id}`, color, width: Math.max(3, size / 2), pts: draftRoute! }] : [])].map((r) => (
                      <marker
                        key={`arrow-${r.id}`}
                        id={`ts-arrow-${r.id}`}
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill={r.color} />
                      </marker>
                    ))}
                  </defs>
                  {layerRoutes.map((r) => {
                    const selected = r.id === selectedRouteId;
                    return (
                      <g key={r.id}>
                        {/* Fat invisible hit area for easy tapping */}
                        <path
                          d={smoothPath(r.pts)}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={Math.max(18, r.width * 3)}
                          style={{ pointerEvents: tool === "move" ? "stroke" : "none", cursor: "pointer" }}
                          onPointerDown={(e) => { e.stopPropagation(); setSelectedRouteId(r.id); }}
                        />
                        <path
                          d={smoothPath(r.pts)}
                          fill="none"
                          stroke={r.color}
                          strokeWidth={r.width}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          markerEnd={`url(#ts-arrow-${r.id})`}
                          style={{
                            pointerEvents: "none",
                            filter: selected ? `drop-shadow(0 0 6px ${r.color})` : undefined,
                            opacity: selected ? 1 : 0.95,
                          }}
                        />
                        {selected && r.pts.map((p, i) => (
                          <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r={7}
                            fill="rgba(255,255,255,0.9)"
                            stroke={r.color}
                            strokeWidth={2}
                            style={{ pointerEvents: "auto", cursor: "grab", touchAction: "none" }}
                            onPointerDown={(e) => onVertexDown(e, r.id, i)}
                          />
                        ))}
                      </g>
                    );
                  })}
                  {showDraft && (
                    <path
                      d={smoothPath(draftRoute!)}
                      fill="none"
                      stroke={color}
                      strokeWidth={Math.max(3, size / 2)}
                      strokeLinecap="round"
                      strokeDasharray="8 6"
                      markerEnd={`url(#ts-arrow-draft-${layer.id})`}
                      style={{ pointerEvents: "none" }}
                    />
                  )}
                </svg>

                {/* Text labels */}
                {layerTexts.map((t) => (
                  <div
                    key={t.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 select-none"
                    style={{ left: t.x, top: t.y, pointerEvents: "auto" }}
                  >
                    {editingTextId === t.id ? (
                      <input
                        autoFocus
                        value={t.text}
                        onChange={(e) => updateText(t.id, { text: e.target.value })}
                        onBlur={() => setEditingTextId(null)}
                        onKeyDown={(e) => { if (e.key === "Enter") setEditingTextId(null); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{ fontSize: t.size, color: t.color }}
                        className="px-2 py-1 rounded-lg bg-background/95 border border-primary/70 min-w-[8rem] text-center outline-none"
                      />
                    ) : (
                      <button
                        onPointerDown={(e) => onTextPointerDown(e, t)}
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingTextId(t.id); }}
                        style={{
                          fontSize: t.size,
                          color: t.color,
                          textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                        }}
                        className={`cursor-move touch-none whitespace-pre px-1 font-semibold leading-tight rounded ${
                          selectedTextId === t.id ? "ring-2 ring-primary/70" : ""
                        }`}
                      >
                        {t.text || "…"}
                      </button>
                    )}
                  </div>
                ))}

                {/* Markers */}
                {layerMarkers.map((m) => {
                  const meta = MARKER_META[m.type];
                  return (
                    <div
                      key={m.id}
                      className="absolute -translate-x-1/2 -translate-y-1/2 select-none"
                      style={{ left: m.x, top: m.y, pointerEvents: "auto" }}
                    >
                      <div
                        onPointerDown={(e) => onMarkerPointerDown(e, m)}
                        className="flex flex-col items-center gap-1 cursor-move touch-none"
                      >
                        {/* Glowing dot marker */}
                        <span
                          className="glow-dot"
                          style={{
                            background: meta.color,
                            boxShadow: `0 0 6px ${meta.color}, 0 0 14px ${meta.color}, 0 0 28px ${meta.color}80`,
                          }}
                          aria-hidden
                        />
                        {editingLabelId === m.id ? (
                          <input
                            autoFocus
                            value={m.label}
                            onChange={(e) => renameMarker(m.id, e.target.value)}
                            onBlur={() => setEditingLabelId(null)}
                            onKeyDown={(e) => { if (e.key === "Enter") setEditingLabelId(null); }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-background/90 border border-border w-24 text-center"
                          />
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingLabelId(m.id); }}
                              onPointerDown={(e) => e.stopPropagation()}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-background/80 border border-border/60 max-w-[8rem] truncate"
                            >
                              {m.label}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeMarker(m.id); }}
                              onPointerDown={(e) => e.stopPropagation()}
                              className="h-4 w-4 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center"
                              aria-label="Delete marker"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Selected text inspector */}
          {selectedText && (
            <div className="absolute left-3 top-3 z-[999] flex items-center gap-2 rounded-2xl glass-panel border border-border/60 px-3 py-2 text-xs">
              <span className="font-semibold">Label</span>
              <Button size="sm" variant="outline" className="h-7 rounded-full" onClick={() => setEditingTextId(selectedText.id)}>Edit</Button>
              <input
                type="color"
                value={selectedText.color}
                onChange={(e) => updateText(selectedText.id, { color: e.target.value })}
                className="color-picker-round"
                aria-label="Label color"
              />
              <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-full" onClick={() => updateText(selectedText.id, { size: Math.max(10, selectedText.size - 2) })} aria-label="Smaller text">−</Button>
              <span className="tabular-nums w-6 text-center">{selectedText.size}</span>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-full" onClick={() => updateText(selectedText.id, { size: Math.min(96, selectedText.size + 2) })} aria-label="Bigger text">+</Button>
              <Button size="sm" variant="destructive" className="h-7 rounded-full" onClick={() => removeText(selectedText.id)}>
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
              <Button size="sm" variant="ghost" className="h-7 rounded-full" onClick={() => setSelectedTextId(null)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Selected route inspector */}
          {selectedRouteId && (() => {
            const r = routes.find((x) => x.id === selectedRouteId);
            if (!r) return null;
            return (
              <div className="absolute left-3 bottom-3 z-[999] flex items-center gap-2 rounded-2xl glass-panel border border-border/60 px-3 py-2 text-xs">
                <span className="font-semibold">Route</span>
                <input
                  type="color"
                  value={r.color}
                  onChange={(e) => recolorRoute(r.id, e.target.value)}
                  className="color-picker-round"
                  aria-label="Route color"
                />
                <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-full" onClick={() => resizeRoute(r.id, -2)} aria-label="Thinner route">−</Button>
                <span className="tabular-nums w-6 text-center">{Math.round(r.width)}</span>
                <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-full" onClick={() => resizeRoute(r.id, 2)} aria-label="Thicker route">+</Button>
                <Button size="sm" variant="destructive" className="h-7 rounded-full" onClick={() => removeRoute(r.id)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
                <Button size="sm" variant="ghost" className="h-7 rounded-full" onClick={() => setSelectedRouteId(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })()}
        </div>

        {/* Layers panel */}
        {layersOpen && (
          <div className="absolute right-0 top-0 bottom-0 w-72 glass-panel border-l border-border/60 p-3 space-y-2 overflow-y-auto custom-scroll z-[1000]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Layers</p>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" className="h-7 rounded-full" onClick={addLayer}>
                  <Plus className="h-3 w-3 mr-1" /> New
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setLayersOpen(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {/* Rendered top-first so the list matches visual stacking */}
            {[...layers].reverse().map((l) => {
              const isActive = l.id === activeLayerId;
              const count =
                routes.filter((r) => r.layerId === l.id).length +
                texts.filter((t) => t.layerId === l.id).length +
                markers.filter((m) => m.layerId === l.id).length;
              return (
                <div
                  key={l.id}
                  className={`rounded-xl border px-2 py-2 text-xs transition-colors ${
                    isActive && l.kind === "vector"
                      ? "border-primary/70 bg-primary/10"
                      : "border-border/60 bg-card/60"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleLayer(l.id)}
                      className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center hover:bg-accent hover:text-accent-foreground"
                      aria-label={l.visible ? `Hide ${l.name}` : `Show ${l.name}`}
                    >
                      {l.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 opacity-60" />}
                    </button>
                    <input
                      value={l.name}
                      onChange={(e) => renameLayer(l.id, e.target.value)}
                      className="flex-1 min-w-0 bg-transparent outline-none border-b border-transparent focus:border-border py-0.5"
                      aria-label="Layer name"
                    />
                    <button
                      onClick={() => moveLayer(l.id, 1)}
                      className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-accent hover:text-accent-foreground"
                      aria-label="Move layer up"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => moveLayer(l.id, -1)}
                      className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-accent hover:text-accent-foreground"
                      aria-label="Move layer down"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground flex-1">
                      {l.kind === "bg" ? "Uploaded map image" : l.kind === "ink" ? "Freehand sketch ink" : `${count} element${count === 1 ? "" : "s"}`}
                    </span>
                    {l.kind === "vector" && (
                      <>
                        <Button
                          size="sm"
                          variant={isActive ? "default" : "outline"}
                          className="h-6 rounded-full text-[10px] px-2"
                          onClick={() => setActiveLayerId(l.id)}
                        >
                          {isActive ? "Active" : "Set active"}
                        </Button>
                        <button
                          onClick={() => deleteLayer(l.id)}
                          className="h-6 w-6 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/15"
                          aria-label={`Delete ${l.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground pt-2">
              New routes, labels and markers land on the active layer. Use the arrows to restack layers.
            </p>
          </div>
        )}

        {/* Marker sidebar */}
        {sidebarOpen && (
          <div className="absolute right-0 top-0 bottom-0 w-64 glass-panel border-l border-border/60 p-3 space-y-2 overflow-y-auto custom-scroll z-[1000]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Drop a marker</p>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSidebarOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {(Object.keys(MARKER_META) as MarkerType[]).map((t) => {
              const meta = MARKER_META[t];
              return (
                <button
                  key={t}
                  onClick={() => addMarker(t)}
                  className="w-full flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 hover:bg-accent hover:text-accent-foreground px-2 py-2 text-left text-xs"
                >
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{
                      background: meta.color,
                      boxShadow: `0 0 6px ${meta.color}, 0 0 12px ${meta.color}`,
                    }}
                    aria-hidden
                  />
                  {t}
                </button>
              );
            })}
            <p className="text-[10px] text-muted-foreground pt-2">
              Markers are added to the active layer ({activeLayerName}). Click a label to rename, drag to reposition, tap × to delete.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
