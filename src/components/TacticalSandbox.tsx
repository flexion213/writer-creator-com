import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload, Menu, X, Trash2, Plus, Minus, Crosshair, ImageOff, MapPin,
} from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

/* ------------------------------------------------------------------ *
 * Azgaar-style SVG tactical map: infinite wheel-zoom, drag-to-pan,
 * uploadable background image, and a bank of draggable markers with
 * editable notes. All state persists to localStorage.
 * ------------------------------------------------------------------ */

type MarkerKind = "castle" | "army" | "city";
type Marker = {
  id: string;
  kind: MarkerKind;
  label: string;
  note: string;
  x: number; // world coords
  y: number;
};
type Bg = { url: string; w: number; h: number };

const WORLD = { w: 2400, h: 1600 };
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 12;

const KIND_META: Record<MarkerKind, { color: string; label: string; glyph: string }> = {
  castle: { color: "#f59e0b", label: "Castle", glyph: "M -9 4 L -9 -4 L -6 -4 L -6 -7 L -3 -7 L -3 -4 L 0 -4 L 0 -7 L 3 -7 L 3 -4 L 6 -4 L 6 -7 L 9 -7 L 9 4 Z" },
  army:   { color: "#ef4444", label: "Army",   glyph: "M -8 6 L 4 -6 M -4 -6 L 8 6 M -8 -6 L -4 -6 L -4 -2 M 8 -6 L 4 -6 L 4 -2" },
  city:   { color: "#38bdf8", label: "City",   glyph: "M -9 5 L -9 -2 L -4 -2 L -4 5 M -2 5 L -2 -8 L 3 -8 L 3 5 M 5 5 L 5 -4 L 9 -4 L 9 5" },
};
const KINDS: MarkerKind[] = ["castle", "army", "city"];

const LS = { bg: "ts2:bg", markers: "ts2:markers", view: "ts2:view" };

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
}
const uid = () => `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function MarkerGlyph({ kind }: { kind: MarkerKind }) {
  const meta = KIND_META[kind];
  const filled = kind !== "army";
  return (
    <path
      d={meta.glyph}
      fill={filled ? meta.color : "none"}
      stroke={meta.color}
      strokeWidth={filled ? 1 : 2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export function TacticalSandbox({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { t } = useLanguage();
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [hydrated, setHydrated] = useState(false);
  const [bg, setBg] = useState<Bg | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ kind: MarkerKind; x: number; y: number } | null>(null);
  const [panning, setPanning] = useState(false);

  /* ---------------- hydrate ---------------- */
  useEffect(() => {
    setBg(readLS<Bg | null>(LS.bg, null));
    const loaded = readLS<Marker[]>(LS.markers, []);
    // de-dupe by id so a double hydrate can never double the marker bank
    const seen = new Set<string>();
    setMarkers(
      (Array.isArray(loaded) ? loaded : []).filter((m) => {
        if (!m || typeof m.id !== "string" || seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      }),
    );
    const v = readLS<{ zoom: number; x: number; y: number } | null>(LS.view, null);
    if (v && Number.isFinite(v.zoom)) {
      setZoom(clamp(v.zoom, MIN_ZOOM, MAX_ZOOM));
      setOff({ x: Number(v.x) || 0, y: Number(v.y) || 0 });
    }
    setHydrated(true);
  }, []);

  /* ---------------- persist ---------------- */
  useEffect(() => {
    if (hydrated) writeLS(LS.markers, markers);
  }, [markers, hydrated]);
  useEffect(() => {
    if (hydrated) writeLS(LS.bg, bg);
  }, [bg, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    const id = window.setTimeout(() => writeLS(LS.view, { zoom, x: off.x, y: off.y }), 250);
    return () => window.clearTimeout(id);
  }, [zoom, off, hydrated]);

  /* ---------------- coordinate helpers ---------------- */
  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      const px = clientX - (rect?.left ?? 0);
      const py = clientY - (rect?.top ?? 0);
      return { x: (px - off.x) / zoom, y: (py - off.y) / zoom };
    },
    [off.x, off.y, zoom],
  );

  /* ---------------- wheel zoom (non-passive, cursor anchored) ---------------- */
  const zoomAt = useCallback((px: number, py: number, factor: number) => {
    setZoom((z) => {
      const next = clamp(z * factor, MIN_ZOOM, MAX_ZOOM);
      const k = next / z;
      setOff((o) => ({ x: px - (px - o.x) * k, y: py - (py - o.y) * k }));
      return next;
    });
  }, []);
  const zoomAtRef = useRef(zoomAt);
  zoomAtRef.current = zoomAt;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      zoomAtRef.current(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-dy * 0.0018));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomButton = (factor: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    zoomAt((rect?.width ?? 0) / 2, (rect?.height ?? 0) / 2, factor);
  };
  const resetView = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    const w = bg?.w ?? WORLD.w;
    const h = bg?.h ?? WORLD.h;
    const z = clamp(Math.min((rect?.width ?? w) / w, (rect?.height ?? h) / h), MIN_ZOOM, MAX_ZOOM);
    setZoom(z);
    setOff({ x: ((rect?.width ?? 0) - w * z) / 2, y: ((rect?.height ?? 0) - h * z) / 2 });
  };

  /* ---------------- pan ---------------- */
  const panState = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const onPanDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    panState.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: off.x, oy: off.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setPanning(true);
    setSelectedId(null);
  };
  const onPanMove = (e: React.PointerEvent) => {
    const p = panState.current;
    if (!p || p.id !== e.pointerId) return;
    setOff({ x: p.ox + (e.clientX - p.sx), y: p.oy + (e.clientY - p.sy) });
  };
  const onPanUp = (e: React.PointerEvent) => {
    if (panState.current?.id === e.pointerId) {
      panState.current = null;
      setPanning(false);
    }
  };

  /* ---------------- marker drag (existing markers) ---------------- */
  const dragState = useRef<{ id: string; pointerId: number } | null>(null);
  const onMarkerDown = (e: React.PointerEvent, m: Marker) => {
    e.stopPropagation();
    dragState.current = { id: m.id, pointerId: e.pointerId };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setSelectedId(m.id);
  };
  const onMarkerMove = (e: React.PointerEvent) => {
    const d = dragState.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const w = toWorld(e.clientX, e.clientY);
    setMarkers((prev) => prev.map((m) => (m.id === d.id ? { ...m, x: w.x, y: w.y } : m)));
  };
  const onMarkerUp = (e: React.PointerEvent) => {
    if (dragState.current?.pointerId === e.pointerId) dragState.current = null;
  };

  /* ---------------- marker bank drag-to-drop ---------------- */
  const bankState = useRef<{ kind: MarkerKind; pointerId: number } | null>(null);
  const onBankDown = (e: React.PointerEvent, kind: MarkerKind) => {
    e.preventDefault();
    bankState.current = { kind, pointerId: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setGhost({ kind, x: e.clientX, y: e.clientY });
  };
  const onBankMove = (e: React.PointerEvent) => {
    const b = bankState.current;
    if (!b || b.pointerId !== e.pointerId) return;
    setGhost({ kind: b.kind, x: e.clientX, y: e.clientY });
  };
  const onBankUp = (e: React.PointerEvent) => {
    const b = bankState.current;
    bankState.current = null;
    setGhost(null);
    if (!b || b.pointerId !== e.pointerId) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const inside =
      e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inside) return;
    const w = toWorld(e.clientX, e.clientY);
    const id = uid();
    setMarkers((prev) => [
      ...prev,
      { id, kind: b.kind, label: KIND_META[b.kind].label, note: "", x: w.x, y: w.y },
    ]);
    setSelectedId(id);
  };
  const addAtCenter = (kind: MarkerKind) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    const w = toWorld((rect?.left ?? 0) + (rect?.width ?? 0) / 2, (rect?.top ?? 0) + (rect?.height ?? 0) / 2);
    const id = uid();
    setMarkers((prev) => [...prev, { id, kind, label: KIND_META[kind].label, note: "", x: w.x, y: w.y }]);
    setSelectedId(id);
  };

  /* ---------------- background upload ---------------- */
  const onUpload = (file: File | null | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      if (!url) return;
      const img = new window.Image();
      img.onload = () => setBg({ url, w: img.naturalWidth || WORLD.w, h: img.naturalHeight || WORLD.h });
      img.onerror = () => setBg({ url, w: WORLD.w, h: WORLD.h });
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  const selected = useMemo(() => markers.find((m) => m.id === selectedId) ?? null, [markers, selectedId]);
  const patchSelected = (patch: Partial<Marker>) =>
    setMarkers((prev) => prev.map((m) => (m.id === selectedId ? { ...m, ...patch } : m)));
  const deleteSelected = () => {
    setMarkers((prev) => prev.filter((m) => m.id !== selectedId));
    setSelectedId(null);
  };

  const mapW = bg?.w ?? WORLD.w;
  const mapH = bg?.h ?? WORLD.h;

  return (
    <div className="fixed inset-0 overflow-hidden bg-background text-foreground select-none">
      {/* ---------- map surface ---------- */}
      <div
        ref={wrapRef}
        className="absolute inset-0 touch-none"
        style={{ cursor: panning ? "grabbing" : "grab" }}
        onPointerDown={onPanDown}
        onPointerMove={(e) => {
          onPanMove(e);
          onMarkerMove(e);
        }}
        onPointerUp={(e) => {
          onPanUp(e);
          onMarkerUp(e);
        }}
        onPointerCancel={(e) => {
          onPanUp(e);
          onMarkerUp(e);
        }}
      >
        <svg className="h-full w-full" role="img" aria-label={t("sandbox")}>
          <defs>
            <pattern id="ts-grid" width={64} height={64} patternUnits="userSpaceOnUse">
              <path d="M 64 0 L 0 0 0 64" fill="none" stroke="currentColor" strokeOpacity={0.14} strokeWidth={1} />
            </pattern>
          </defs>
          <g transform={`translate(${off.x} ${off.y}) scale(${zoom})`}>
            {/* map plate */}
            <rect
              x={0}
              y={0}
              width={mapW}
              height={mapH}
              fill="currentColor"
              fillOpacity={0.04}
              stroke="currentColor"
              strokeOpacity={0.3}
              strokeWidth={1 / zoom}
            />
            {bg ? (
              <image href={bg.url} x={0} y={0} width={mapW} height={mapH} preserveAspectRatio="none" />
            ) : (
              <rect x={0} y={0} width={mapW} height={mapH} fill="url(#ts-grid)" className="text-foreground" />
            )}

            {/* markers */}
            {markers.map((m) => {
              const meta = KIND_META[m.kind];
              const active = m.id === selectedId;
              const s = 1 / zoom; // keep pins a constant screen size
              return (
                <g
                  key={m.id}
                  transform={`translate(${m.x} ${m.y}) scale(${s})`}
                  style={{ cursor: "move" }}
                  onPointerDown={(e) => onMarkerDown(e, m)}
                >
                  <circle
                    r={16}
                    fill="hsl(var(--card))"
                    fillOpacity={0.92}
                    stroke={meta.color}
                    strokeWidth={active ? 3 : 1.6}
                  />
                  <MarkerGlyph kind={m.kind} />
                  {(m.label || "").trim() && (
                    <text
                      y={30}
                      textAnchor="middle"
                      fontSize={12}
                      fill="currentColor"
                      className="text-foreground"
                      style={{ paintOrder: "stroke", pointerEvents: "none" }}
                      stroke="hsl(var(--background))"
                      strokeWidth={3}
                    >
                      {m.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* ---------- top bar ---------- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card/85 px-2 py-1 backdrop-blur">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("openMenu")} onClick={onOpenMenu}>
            <Menu className="h-4 w-4" />
          </Button>
          <span className="pr-1 text-xs font-semibold tracking-wide">{t("sandbox")}</span>
        </div>
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/85 px-1.5 py-1 backdrop-blur">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Zoom out" onClick={() => zoomButton(1 / 1.4)}>
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-[11px] tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Zoom in" onClick={() => zoomButton(1.4)}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Fit map" onClick={resetView}>
            <Crosshair className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ---------- marker bank + background upload ---------- */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-2xl border border-border bg-card/90 p-2 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2">
          {KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onPointerDown={(e) => onBankDown(e, kind)}
              onPointerMove={onBankMove}
              onPointerUp={onBankUp}
              onPointerCancel={() => {
                bankState.current = null;
                setGhost(null);
              }}
              onDoubleClick={() => addAtCenter(kind)}
              className="flex w-16 cursor-grab flex-col items-center gap-1 rounded-xl border border-border/70 px-1 py-1.5 text-[10px] font-medium hover:bg-accent active:cursor-grabbing"
              title={`${KIND_META[kind].label} — drag onto the map`}
            >
              <svg width={26} height={26} viewBox="-13 -13 26 26" aria-hidden="true">
                <MarkerGlyph kind={kind} />
              </svg>
              {KIND_META[kind].label}
            </button>
          ))}
          <div className="mx-1 h-10 w-px bg-border" />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onUpload(e.target.files?.[0]);
              e.currentTarget.value = "";
            }}
          />
          <Button variant="secondary" size="sm" className="h-9" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" />
            {bg ? "Replace map" : "Upload map"}
          </Button>
          {bg && (
            <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Remove background" onClick={() => setBg(null)}>
              <ImageOff className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* ---------- note editor ---------- */}
      {selected && (
        <div className="absolute right-3 top-16 w-64 rounded-2xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <MapPin className="h-3.5 w-3.5" style={{ color: KIND_META[selected.kind].color }} />
              {KIND_META[selected.kind].label}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("close")} onClick={() => setSelectedId(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Input
            value={selected.label}
            placeholder="Name"
            className="mb-2 h-8 text-sm"
            onChange={(e) => patchSelected({ label: e.target.value })}
          />
          <Textarea
            value={selected.note}
            placeholder="Notes…"
            rows={5}
            className="mb-2 text-sm"
            onChange={(e) => patchSelected({ note: e.target.value })}
          />
          <div className="flex items-center gap-1">
            {KINDS.map((k) => (
              <Button
                key={k}
                variant={k === selected.kind ? "default" : "outline"}
                size="sm"
                className="h-7 flex-1 px-1 text-[10px]"
                onClick={() => patchSelected({ kind: k })}
              >
                {KIND_META[k].label}
              </Button>
            ))}
          </div>
          <Button variant="destructive" size="sm" className="mt-2 w-full h-8" onClick={deleteSelected}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      )}

      {/* ---------- drag ghost ---------- */}
      {ghost && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-card/90 p-1.5 shadow"
          style={{ left: ghost.x, top: ghost.y }}
        >
          <svg width={26} height={26} viewBox="-13 -13 26 26" aria-hidden="true">
            <MarkerGlyph kind={ghost.kind} />
          </svg>
        </div>
      )}
    </div>
  );
}
