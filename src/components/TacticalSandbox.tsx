import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Upload, Brush, Eraser, Route as RouteIcon, PaintBucket, Trash2,
  Download, Home, Skull, Target, Package, Tag, X, Menu, Undo2, ImageOff,
} from "lucide-react";

type MarkerType = "Safehouse" | "Enemy Territory" | "Objective" | "Resource Stash" | "Custom Label";
type Marker = { id: string; type: MarkerType; label: string; x: number; y: number };
type Tool = "brush" | "eraser" | "route" | "bucket" | "move";

const MARKER_META: Record<MarkerType, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  "Safehouse":        { icon: Home,    color: "#10b981" },
  "Enemy Territory":  { icon: Skull,   color: "#ef4444" },
  "Objective":        { icon: Target,  color: "#f59e0b" },
  "Resource Stash":   { icon: Package, color: "#3b82f6" },
  "Custom Label":     { icon: Tag,     color: "#a855f7" },
};

const LS = {
  bg: "ts:bg",
  canvas: "ts:canvas",
  markers: "ts:markers",
  tool: "ts:tool",
  color: "ts:color",
  size: "ts:size",
};

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
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const draggingMarker = useRef<{ id: string; dx: number; dy: number } | null>(null);

  // Hydrate
  useEffect(() => {
    try {
      const rawBg = localStorage.getItem(LS.bg);
      const rawM = localStorage.getItem(LS.markers);
      const rawT = localStorage.getItem(LS.tool);
      const rawC = localStorage.getItem(LS.color);
      const rawS = localStorage.getItem(LS.size);
      if (rawBg) setBg(rawBg);
      if (rawM) setMarkers(JSON.parse(rawM));
      if (rawT) setTool(rawT as Tool);
      if (rawC) setColor(rawC);
      if (rawS) setSize(Number(rawS) || 8);
    } catch {}
    setHydrated(true);
  }, []);

  // Persist prefs
  useEffect(() => { if (hydrated) try { localStorage.setItem(LS.tool, tool); } catch {} }, [tool, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(LS.color, color); } catch {} }, [color, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(LS.size, String(size)); } catch {} }, [size, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(LS.markers, JSON.stringify(markers)); } catch {} }, [markers, hydrated]);

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

  const getPt = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * c.width) / r.width,
      y: ((e.clientY - r.top) * c.height) / r.height,
    };
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

  const onPointerDown = (e: React.PointerEvent) => {
    if (tool === "move") return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = getPt(e);
    if (tool === "bucket") { floodFill(p.x, p.y, color); return; }
    const ctx = ctxRef.current!;
    drawing.current = true;
    lastPt.current = p;
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = tool === "route" ? Math.max(3, size / 2) : size;
    ctx.beginPath();
    ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
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
    persistCanvas();
  };

  const clearAll = () => {
    if (!confirm("Clear the entire canvas?")) return;
    const c = canvasRef.current!, ctx = ctxRef.current!;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, c.width, c.height);
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

  // Marker helpers
  const addMarker = (type: MarkerType) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    setMarkers((m) => [...m, {
      id: crypto.randomUUID(), type, label: type,
      x: r.width / 2, y: r.height / 2,
    }]);
    setSidebarOpen(false);
  };
  const removeMarker = (id: string) => setMarkers((m) => m.filter((x) => x.id !== id));
  const renameMarker = (id: string, label: string) => setMarkers((m) => m.map((x) => x.id === id ? { ...x, label } : x));

  const onMarkerPointerDown = (e: React.PointerEvent, m: Marker) => {
    e.stopPropagation();
    const wrap = wrapRef.current!;
    const r = wrap.getBoundingClientRect();
    draggingMarker.current = { id: m.id, dx: e.clientX - r.left - m.x, dy: e.clientY - r.top - m.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onMarkerPointerMove = (e: React.PointerEvent) => {
    const d = draggingMarker.current;
    if (!d) return;
    const wrap = wrapRef.current!;
    const r = wrap.getBoundingClientRect();
    const nx = Math.max(0, Math.min(r.width, e.clientX - r.left - d.dx));
    const ny = Math.max(0, Math.min(r.height, e.clientY - r.top - d.dy));
    setMarkers((all) => all.map((x) => x.id === d.id ? { ...x, x: nx, y: ny } : x));
  };
  const onMarkerPointerUp = () => { draggingMarker.current = null; };

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
    { id: "bucket", label: "Paint bucket", icon: PaintBucket },
    { id: "eraser", label: "Eraser",      icon: Eraser },
    { id: "move",   label: "Move",        icon: Menu },
  ];

  const PRESET_COLORS = ["#22c55e", "#ef4444", "#3b82f6", "#f59e0b", "#a855f7", "#e11d48", "#ffffff", "#0f172a"];

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
        <Button variant="ghost" size="sm" className="h-8" onClick={() => setSidebarOpen((s) => !s)}>
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
          onPointerMove={onMarkerPointerMove}
          onPointerUp={onMarkerPointerUp}
        >
          {bg && (
            <img
              src={bg}
              alt="Map background"
              className="absolute inset-0 h-full w-full object-contain pointer-events-none select-none"
              draggable={false}
            />
          )}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            style={{ cursor: tool === "move" ? "default" : tool === "bucket" ? "crosshair" : "crosshair" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          {/* Markers */}
          {markers.map((m) => {
            const meta = MARKER_META[m.type];
            const Icon = meta.icon;
            return (
              <div
                key={m.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 select-none"
                style={{ left: m.x, top: m.y }}
              >
                <div
                  onPointerDown={(e) => onMarkerPointerDown(e, m)}
                  className="flex flex-col items-center gap-1 cursor-move touch-none"
                >
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center shadow-elegant border-2"
                    style={{ background: meta.color, borderColor: "rgba(0,0,0,0.4)" }}
                  >
                    <Icon className="h-4 w-4 text-white" />
                  </div>
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

        {/* Marker sidebar */}
        {sidebarOpen && (
          <div className="absolute right-0 top-0 bottom-0 w-64 glass-panel border-l border-border/60 p-3 space-y-2 overflow-y-auto z-10">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Drop a marker</p>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setSidebarOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {(Object.keys(MARKER_META) as MarkerType[]).map((t) => {
              const meta = MARKER_META[t];
              const Icon = meta.icon;
              return (
                <button
                  key={t}
                  onClick={() => addMarker(t)}
                  className="w-full flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 hover:bg-accent hover:text-accent-foreground px-2 py-2 text-left text-xs"
                >
                  <span
                    className="h-6 w-6 rounded-full flex items-center justify-center"
                    style={{ background: meta.color }}
                  >
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </span>
                  {t}
                </button>
              );
            })}
            <p className="text-[10px] text-muted-foreground pt-2">
              Tip: click a marker's label to rename, drag it to reposition, tap × to delete.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}