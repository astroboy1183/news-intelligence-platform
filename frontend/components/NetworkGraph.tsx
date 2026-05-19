"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type ForceLink,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

import type { NetworkEdge, NetworkNode } from "@/lib/types";

type SimNode = NetworkNode & SimulationNodeDatum;
type SimEdge = SimulationLinkDatum<SimNode> & { weight: number };

// Galaxy palette — one color per common entity type, mapped to the dashboard's
// cyan/purple/emerald/amber tone system so the graph reads as part of the same world.
const TYPE_COLOR: Record<string, string> = {
  PERSON: "#7dd3fc",     // cyan-300
  ORG: "#c4b5fd",        // violet-300
  GPE: "#86efac",        // emerald-300
  LOC: "#86efac",
  NORP: "#fcd34d",       // amber-300
  EVENT: "#f9a8d4",      // pink-300
  PRODUCT: "#fda4af",    // rose-300
  WORK_OF_ART: "#a5b4fc",
  LAW: "#fdba74",
};
const FALLBACK_COLOR = "#cbd5e1"; // slate-300

function colorFor(type: string): string {
  return TYPE_COLOR[type] ?? FALLBACK_COLOR;
}

// Pure radius from weight. sqrt scale keeps huge hubs from dominating.
function radiusFor(weight: number, maxWeight: number): number {
  const t = Math.sqrt(weight / Math.max(1, maxWeight));
  return 4 + t * 18;
}

type Props = {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  height?: number;
};

export default function NetworkGraph({ nodes: rawNodes, edges: rawEdges, height = 620 }: Props) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<Simulation<SimNode, SimEdge> | null>(null);
  const animRef = useRef<number | null>(null);

  const [hoverId, setHoverId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  // View transform (zoom + pan), kept in a ref to avoid re-rendering on drag.
  const viewRef = useRef({ scale: 1, x: 0, y: 0 });
  const draggingRef = useRef<{ x: number; y: number } | null>(null);

  // Distinct types for the type filter chips.
  const types = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of rawNodes) counts[n.type] = (counts[n.type] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [rawNodes]);

  // Filter nodes + drop now-orphan edges. Re-run on filter change.
  const { nodes, edges, maxWeight, neighborSet } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const visibleIds = new Set<number>();
    for (const n of rawNodes) {
      if (filterType !== "all" && n.type !== filterType) continue;
      if (q && !n.name.toLowerCase().includes(q)) continue;
      visibleIds.add(n.id);
    }
    const ns = rawNodes.filter((n) => visibleIds.has(n.id));
    const es = rawEdges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target));
    const max = ns.reduce((m, n) => Math.max(m, n.weight), 1);
    const adj = new Map<number, Set<number>>();
    for (const e of es) {
      if (!adj.has(e.source)) adj.set(e.source, new Set());
      if (!adj.has(e.target)) adj.set(e.target, new Set());
      adj.get(e.source)!.add(e.target);
      adj.get(e.target)!.add(e.source);
    }
    return { nodes: ns, edges: es, maxWeight: max, neighborSet: adj };
  }, [rawNodes, rawEdges, filterType, search]);

  // Spin up the d3-force simulation. We don't drive React renders from the tick —
  // we paint directly to the Canvas to keep 200+ nodes at 60fps.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = wrap.clientWidth;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    // Copy nodes/edges so the simulation can mutate (.x, .y, .vx, .vy).
    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const idToNode = new Map(simNodes.map((n) => [n.id, n] as const));
    const simEdges: SimEdge[] = edges
      .map((e) => {
        const s = idToNode.get(e.source);
        const t = idToNode.get(e.target);
        if (!s || !t) return null;
        return { source: s, target: t, weight: e.weight } as SimEdge;
      })
      .filter((e): e is SimEdge => e !== null);

    const sim = forceSimulation<SimNode, SimEdge>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimEdge>(simEdges)
          .id((d) => d.id)
          .distance((d) => 60 + 40 / Math.sqrt(d.weight))
          .strength(0.4),
      )
      .force("charge", forceManyBody<SimNode>().strength(-220))
      .force("center", forceCenter(width / 2, height / 2).strength(0.05))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => radiusFor(d.weight, maxWeight) + 4),
      )
      .alpha(0.9)
      .alphaDecay(0.025);

    simRef.current = sim;

    const draw = () => {
      const view = viewRef.current;
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(view.x, view.y);
      ctx.scale(view.scale, view.scale);

      // Highlight set: hovered node + its neighbors.
      const hl = hoverId;
      const nbrs = hl != null ? neighborSet.get(hl) ?? new Set() : null;

      // Edges first so nodes sit on top.
      for (const e of simEdges) {
        const s = e.source as SimNode;
        const t = e.target as SimNode;
        if (s.x == null || s.y == null || t.x == null || t.y == null) continue;
        const isHl =
          hl != null && (s.id === hl || t.id === hl);
        ctx.globalAlpha = hl == null ? 0.15 : isHl ? 0.7 : 0.04;
        ctx.strokeStyle = isHl ? "#67e8f9" : "#475569"; // cyan-300 vs slate-600
        ctx.lineWidth = Math.min(2.2, 0.4 + e.weight / 12);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Nodes.
      for (const n of simNodes) {
        if (n.x == null || n.y == null) continue;
        const r = radiusFor(n.weight, maxWeight);
        const isHl = hl != null && (n.id === hl || nbrs?.has(n.id));
        ctx.globalAlpha = hl == null ? 1 : isHl ? 1 : 0.18;

        // Galaxy glow: radial gradient halo behind every node.
        const glow = ctx.createRadialGradient(n.x, n.y, r * 0.4, n.x, n.y, r * 2.6);
        glow.addColorStop(0, colorFor(n.type) + "55");
        glow.addColorStop(1, colorFor(n.type) + "00");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 2.6, 0, Math.PI * 2);
        ctx.fill();

        // Solid core.
        ctx.fillStyle = colorFor(n.type);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();

        // Outline.
        ctx.strokeStyle = "rgba(15,23,42,0.6)";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Labels on the bigger nodes or when highlighted.
        const showLabel = isHl || n.weight >= maxWeight * 0.25;
        if (showLabel) {
          ctx.fillStyle = "rgba(241,245,249,0.95)";
          ctx.font = `${Math.min(13, 10 + r * 0.15)}px ui-sans-serif, system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(n.name, n.x, n.y + r + 4);
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    sim.on("tick", () => {
      if (animRef.current != null) return;
      animRef.current = requestAnimationFrame(() => {
        animRef.current = null;
        draw();
      });
    });

    // Hit-test in canvas space (account for current zoom/pan).
    const pickNode = (clientX: number, clientY: number): SimNode | null => {
      const rect = canvas.getBoundingClientRect();
      const view = viewRef.current;
      const x = (clientX - rect.left - view.x) / view.scale;
      const y = (clientY - rect.top - view.y) / view.scale;
      // Test largest-first so hover prefers the prominent node when overlapping.
      const sorted = [...simNodes].sort((a, b) => b.weight - a.weight);
      for (const n of sorted) {
        if (n.x == null || n.y == null) continue;
        const r = radiusFor(n.weight, maxWeight);
        const dx = n.x - x;
        const dy = n.y - y;
        if (dx * dx + dy * dy <= r * r) return n;
      }
      return null;
    };

    const onMove = (ev: MouseEvent) => {
      if (draggingRef.current) {
        const view = viewRef.current;
        view.x += ev.clientX - draggingRef.current.x;
        view.y += ev.clientY - draggingRef.current.y;
        draggingRef.current = { x: ev.clientX, y: ev.clientY };
        draw();
        return;
      }
      const hit = pickNode(ev.clientX, ev.clientY);
      const next = hit?.id ?? null;
      setHoverId((prev) => (prev === next ? prev : next));
      canvas.style.cursor = hit ? "pointer" : "grab";
    };

    const onDown = (ev: MouseEvent) => {
      draggingRef.current = { x: ev.clientX, y: ev.clientY };
      canvas.style.cursor = "grabbing";
    };
    const onUp = (ev: MouseEvent) => {
      const wasDrag =
        draggingRef.current &&
        (Math.abs(ev.clientX - draggingRef.current.x) > 3 ||
          Math.abs(ev.clientY - draggingRef.current.y) > 3);
      draggingRef.current = null;
      canvas.style.cursor = "grab";
      if (!wasDrag) {
        const hit = pickNode(ev.clientX, ev.clientY);
        if (hit) router.push(`/entities/${encodeURIComponent(hit.slug)}`);
      }
    };

    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const view = viewRef.current;
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      const factor = Math.exp(-ev.deltaY * 0.0015);
      const next = Math.max(0.3, Math.min(3, view.scale * factor));
      // Zoom towards cursor — anchor the world point under the cursor.
      view.x = mx - ((mx - view.x) * next) / view.scale;
      view.y = my - ((my - view.y) * next) / view.scale;
      view.scale = next;
      draw();
    };

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.style.cursor = "grab";

    // Initial paint before sim warms up so users don't see a blank canvas.
    draw();

    return () => {
      sim.stop();
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("wheel", onWheel);
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
    };
    // We intentionally exclude hoverId so hover doesn't restart the simulation —
    // the draw() closure captures it via a ref-like reactivity through React's render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, maxWeight, height, hoverId, neighborSet, router]);

  const hoverNode = useMemo(() => nodes.find((n) => n.id === hoverId), [nodes, hoverId]);

  return (
    <div className="flex flex-col gap-3">
      {/* Filter controls */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter entities…"
          className="w-56 rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500/60 focus:outline-none"
        />
        <button
          onClick={() => setFilterType("all")}
          className={`rounded-full border px-3 py-1 text-xs ${
            filterType === "all"
              ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-200"
              : "border-slate-700 text-slate-400 hover:border-slate-500"
          }`}
        >
          all
        </button>
        {types.slice(0, 8).map(([t, c]) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
              filterType === t
                ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-200"
                : "border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: colorFor(t) }}
            />
            {t} <span className="text-slate-500">{c}</span>
          </button>
        ))}
        <div className="ml-auto text-xs text-slate-500">
          scroll to zoom · drag to pan · click a node to drill in
        </div>
      </div>

      {/* Canvas + floating hover card */}
      <div
        ref={wrapRef}
        className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-[#03051a] via-[#080a25] to-[#05071c]"
        style={{ height }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
        {hoverNode && (
          <div className="pointer-events-none absolute left-4 top-4 max-w-sm rounded-2xl border border-cyan-500/30 bg-slate-950/85 px-4 py-3 text-sm shadow-2xl backdrop-blur">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: colorFor(hoverNode.type) }}
              />
              <span className="font-semibold text-slate-100">{hoverNode.name}</span>
              <span className="ml-auto text-xs uppercase tracking-wider text-slate-500">
                {hoverNode.type}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              network weight <span className="text-cyan-300">{hoverNode.weight}</span>
              {" · "}
              {neighborSet.get(hoverNode.id)?.size ?? 0} co-mentioned entities
            </div>
          </div>
        )}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
            No entities match the current filter.
          </div>
        )}
      </div>
    </div>
  );
}
