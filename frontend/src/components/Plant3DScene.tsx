"use client";

import { useMemo, useState } from "react";
import {
  Fan,
  Droplets,
  Cog,
  ArrowRightLeft,
  Construction,
  LayoutGrid,
  Box,
  MapPin,
  ChevronRight,
  Activity,
} from "lucide-react";
import { PLANT_RISK_STYLES, RISK_COLORS } from "@/lib/design-tokens";
import { LiveAsset } from "@/lib/api";

const RISK = PLANT_RISK_STYLES;

type Kind = "blower" | "pump" | "motor" | "conveyor" | "crane";

const GRID: Record<
  string,
  {
    gx: number;
    gy: number;
    zone: "blast" | "mill" | "logistics";
    zoneLabel: string;
    short: string;
    kind: Kind;
    Icon: typeof Fan;
    pin: number;
  }
> = {
  "BF-BLOWER-01": {
    gx: 1.8,
    gy: 2.8,
    zone: "blast",
    zoneLabel: "Blast Furnace",
    short: "Blower Unit",
    kind: "blower",
    Icon: Fan,
    pin: 1,
  },
  "BF-PUMP-05": {
    gx: 3.1,
    gy: 2.8,
    zone: "blast",
    zoneLabel: "Blast Furnace",
    short: "Cooling Pump",
    kind: "pump",
    Icon: Droplets,
    pin: 2,
  },
  "RM-MOTOR-03": {
    gx: 4.4,
    gy: 2.8,
    zone: "mill",
    zoneLabel: "Rolling Mill",
    short: "Main Motor",
    kind: "motor",
    Icon: Cog,
    pin: 3,
  },
  "CV-SYSTEM-12": {
    gx: 5.7,
    gy: 2.8,
    zone: "logistics",
    zoneLabel: "Raw Material",
    short: "Conveyor",
    kind: "conveyor",
    Icon: ArrowRightLeft,
    pin: 4,
  },
  "OH-CRANE-02": {
    gx: 7.0,
    gy: 2.8,
    zone: "logistics",
    zoneLabel: "Melting Shop",
    short: "Overhead Crane",
    kind: "crane",
    Icon: Construction,
    pin: 5,
  },
};

const ZONES = [
  {
    id: "blast" as const,
    title: "BLAST FURNACE",
    subtitle: "Ironmaking · Zone A",
    color: RISK_COLORS.high,
    bg: "rgba(196, 122, 69, 0.08)",
    border: "rgba(196, 122, 69, 0.35)",
    codes: ["BF-BLOWER-01", "BF-PUMP-05"],
  },
  {
    id: "mill" as const,
    title: "ROLLING MILL",
    subtitle: "Hot Strip · Zone B",
    color: RISK_COLORS.medium,
    bg: "rgba(184, 146, 74, 0.08)",
    border: "rgba(184, 146, 74, 0.35)",
    codes: ["RM-MOTOR-03"],
  },
  {
    id: "logistics" as const,
    title: "LOGISTICS",
    subtitle: "Material Flow · Zone C",
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.35)",
    codes: ["CV-SYSTEM-12", "OH-CRANE-02"],
  },
];

const CX = 450;
const CY = 155;
const ISO_X = 36;
const ISO_Y = 20;

/** Compact scale for 3D isometric view — keeps all 5 pins in frame */
const ISO_MODEL_SCALE = 0.52;

const STEEL = {
  top: "#9aa8b8",
  face: "#6b7a8a",
  side: "#4a5662",
  dark: "#2a3239",
  concrete: "#4d565f",
  asphalt: "#353c44",
};

function toScreen(gx: number, gy: number, lift = 0) {
  return {
    x: CX + (gx - gy) * ISO_X,
    y: CY + (gx + gy) * ISO_Y - lift,
  };
}

function isoPrism(ax: number, ay: number, w: number, h: number, d: number) {
  const dx = d * 0.866;
  const dy = d * 0.5;
  return {
    top: `M ${ax + dx},${ay - dy} L ${ax + w + dx},${ay - dy - dy} L ${ax + w},${ay - dy} L ${ax},${ay} Z`,
    left: `M ${ax},${ay} L ${ax},${ay - h} L ${ax + dx},${ay - h - dy} L ${ax + dx},${ay - dy} Z`,
    right: `M ${ax + dx},${ay - dy} L ${ax + w + dx},${ay - dy - dy} L ${ax + w + dx},${ay - h - dy - dy} L ${ax + dx},${ay - h - dy} Z`,
  };
}

interface Plant3DSceneProps {
  assets: LiveAsset[];
  selected?: string;
  onSelect?: (code: string) => void;
  streamActive?: boolean;
}

function MetalBlock({
  ax,
  ay,
  w,
  h,
  d,
  statusColor,
}: {
  ax: number;
  ay: number;
  w: number;
  h: number;
  d: number;
  statusColor: string;
}) {
  const p = isoPrism(ax, ay, w, h, d);
  return (
    <g>
      <polygon points={p.left} fill="url(#metal-side)" stroke="#1e2630" strokeWidth={1} />
      <polygon points={p.right} fill="url(#metal-face)" stroke="#1e2630" strokeWidth={1} />
      <polygon points={p.top} fill="url(#metal-top)" stroke="#1e2630" strokeWidth={1} />
      <polygon points={p.top} fill={statusColor} opacity={0.35} />
    </g>
  );
}

function EquipmentModel({
  kind,
  anchor,
  health,
  risk,
  selected,
  pin,
  sizeScale = 1,
}: {
  kind: Kind;
  anchor: { x: number; y: number };
  health: number;
  risk: (typeof RISK)[keyof typeof RISK];
  selected: boolean;
  pin: number;
  sizeScale?: number;
}) {
  const scale = (1 + (health / 100) * 0.25) * sizeScale;
  const ax = anchor.x;
  const ay = anchor.y;

  const foundation = (
    <g>
      <ellipse cx={ax} cy={ay + 10} rx={34 * scale} ry={9} fill="rgba(0,0,0,0.45)" />
      <ellipse
        cx={ax}
        cy={ay + 7}
        rx={30 * scale}
        ry={7}
        fill={STEEL.concrete}
        stroke={selected ? "#d4d4d8" : risk.ring}
        strokeWidth={selected ? 3 : 2}
      />
    </g>
  );

  const pinBadge = (
    <g>
      <circle cx={ax} cy={ay - 52 * scale} r={11} fill={risk.ring} stroke="#fff" strokeWidth={1.5} />
      <text x={ax} y={ay - 48 * scale} textAnchor="middle" fill="#fff" fontSize={10} fontWeight={800}>
        {pin}
      </text>
    </g>
  );

  if (kind === "blower") {
    const h = Math.round(52 * scale);
    const w = 28;
    return (
      <g>
        {foundation}
        <MetalBlock ax={ax - w / 2} ay={ay} w={w} h={h * 0.5} d={16} statusColor={risk.ring} />
        <rect x={ax - 10 * scale} y={ay - h - 6} width={20 * scale} height={h * 0.5} rx={1} fill="url(#metal-face)" stroke="#1e2630" />
        <ellipse cx={ax} cy={ay - h - 6} rx={9 * scale} ry={4} fill={STEEL.top} stroke="#1e2630" />
        {pinBadge}
      </g>
    );
  }

  if (kind === "pump") {
    const w = 30;
    const h = Math.round(26 * scale);
    return (
      <g>
        {foundation}
        <MetalBlock ax={ax - w / 2} ay={ay} w={w} h={h} d={14} statusColor={risk.ring} />
        <rect x={ax + 14} y={ay - h / 2 - 2} width={12} height={6} rx={2} fill={STEEL.side} stroke={risk.ring} strokeWidth={1.5} />
        {pinBadge}
      </g>
    );
  }

  if (kind === "motor") {
    const w = 46;
    const h = Math.round(30 * scale);
    return (
      <g>
        {foundation}
        <MetalBlock ax={ax - w / 2} ay={ay} w={w} h={h} d={18} statusColor={risk.ring} />
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1={ax - w / 2 + 6 + i * 10}
            y1={ay - h - 4}
            x2={ax - w / 2 + 10 + i * 10}
            y2={ay - h - 10}
            stroke={STEEL.dark}
            strokeWidth={1.5}
          />
        ))}
        <circle cx={ax + 14} cy={ay - h / 2} r={6} fill={STEEL.dark} stroke={risk.ring} strokeWidth={1.5} />
        {pinBadge}
      </g>
    );
  }

  if (kind === "conveyor") {
    const w = 52;
    const h = 14;
    return (
      <g>
        {foundation}
        <MetalBlock ax={ax - w / 2} ay={ay} w={w} h={h} d={14} statusColor={risk.ring} />
        <MetalBlock ax={ax - w / 2 - 6} ay={ay - 3} w={8} h={20 * scale} d={7} statusColor={risk.ring} />
        <MetalBlock ax={ax + w / 2 - 2} ay={ay - 3} w={8} h={18 * scale} d={7} statusColor={risk.ring} />
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={i} cx={ax - 18 + i * 9} cy={ay - h - 2} r={2.5} fill={STEEL.top} stroke="#1e2630" />
        ))}
        {pinBadge}
      </g>
    );
  }

  const h = Math.round(42 * scale);
  return (
    <g>
      {foundation}
      <MetalBlock ax={ax - 6} ay={ay} w={12} h={h} d={9} statusColor={risk.ring} />
      <polygon
        points={`${ax - 6},${ay - h - 5} ${ax + 30},${ay - h - 14} ${ax + 30},${ay - h - 20} ${ax - 6},${ay - h - 11}`}
        fill="url(#metal-top)"
        stroke="#1e2630"
        strokeWidth={0.8}
      />
      <line x1={ax + 8} y1={ay - h - 16} x2={ax + 8} y2={ay - h - 30} stroke={STEEL.side} strokeWidth={2} />
      <rect x={ax + 3} y={ay - h - 34} width={10} height={5} rx={1} fill={risk.ring} />
      {pinBadge}
    </g>
  );
}

function sortByPin(assets: LiveAsset[]) {
  return [...assets].sort((a, b) => {
    const pa = GRID[a.equipment_code]?.pin ?? 99;
    const pb = GRID[b.equipment_code]?.pin ?? 99;
    return pa - pb;
  });
}

function StripCard({
  asset,
  layout,
  selected,
  onSelect,
}: {
  asset: LiveAsset;
  layout: (typeof GRID)[string];
  selected: boolean;
  onSelect: () => void;
}) {
  const risk = RISK[asset.risk_level as keyof typeof RISK] ?? RISK.medium;
  const Icon = layout.Icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-[118px] w-full min-w-0 flex-col items-center justify-between gap-1 rounded-lg border-2 px-2 py-2.5 text-center transition-all duration-200 ${
        selected ? "shadow-md shadow-black/40" : "hover:bg-white/[0.04]"
      }`}
      style={{
        backgroundColor: selected ? risk.bg : "rgba(18,24,34,0.95)",
        borderColor: selected ? risk.ring : "rgba(255,255,255,0.12)",
      }}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
        style={{ backgroundColor: risk.ring }}
      >
        {layout.pin}
      </span>

      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: risk.bg, color: risk.ring, border: `1.5px solid ${risk.ring}` }}
      >
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </div>

      <div className="w-full min-w-0 px-0.5">
        <div className="truncate text-[11px] font-bold leading-tight text-white">{layout.short}</div>
        <div className="text-lg font-extrabold tabular-nums leading-none text-white">
          {asset.health_score.toFixed(0)}%
        </div>
      </div>

      <span
        className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide"
        style={{ backgroundColor: risk.badge, color: risk.text }}
      >
        {risk.label}
      </span>
    </button>
  );
}

function AssetCard({
  asset,
  layout,
  selected,
  onSelect,
  streamActive,
  compact,
}: {
  asset: LiveAsset;
  layout: (typeof GRID)[string];
  selected: boolean;
  onSelect: () => void;
  streamActive?: boolean;
  compact?: boolean;
}) {
  const risk = RISK[asset.risk_level as keyof typeof RISK] ?? RISK.medium;
  const Icon = layout.Icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full rounded-xl border-2 text-left transition-all duration-200 ${
        selected
          ? "border-white/30 shadow-lg shadow-black/40"
          : "border-white/10 hover:border-white/20 hover:bg-white/[0.03]"
      }`}
      style={{
        backgroundColor: selected ? risk.bg : "rgba(15,23,35,0.6)",
        borderColor: selected ? risk.ring : undefined,
      }}
    >
      <div className={`flex ${compact ? "flex-col gap-2 p-3" : "items-start gap-3 p-4"}`}>
        <div
          className={`flex shrink-0 items-center justify-center rounded-xl ${compact ? "h-12 w-12" : "h-14 w-14"}`}
          style={{ backgroundColor: risk.bg, color: risk.ring, border: `2px solid ${risk.ring}` }}
        >
          <Icon className={compact ? "h-6 w-6" : "h-7 w-7"} strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className={`font-bold text-white ${compact ? "text-sm" : "text-base"}`}>{layout.short}</div>
              <div className="text-[11px] text-gray-400">{layout.zoneLabel}</div>
            </div>
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: risk.ring }}
            >
              {layout.pin}
            </span>
          </div>

          <div className="mt-2 font-mono text-[10px] text-gray-500">{asset.equipment_code}</div>

          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1">
              <div className="mb-1 flex justify-between text-[10px] text-gray-500">
                <span>Health</span>
                <span className="font-bold text-white">{asset.health_score.toFixed(0)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(asset.health_score, 4)}%`,
                    backgroundColor: risk.ring,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: risk.badge, color: risk.text }}
            >
              {risk.label}
            </span>
            {asset.rul_cycles != null && (
              <span className="text-[10px] text-gray-400">RUL {asset.rul_cycles} cycles</span>
            )}
            {streamActive && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Live
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function SchematicView({
  assets,
  selected,
  onSelect,
  streamActive,
}: {
  assets: LiveAsset[];
  selected?: string;
  onSelect?: (code: string) => void;
  streamActive?: boolean;
}) {
  const byCode = useMemo(() => Object.fromEntries(assets.map((a) => [a.equipment_code, a])), [assets]);

  return (
    <div className="flex min-h-[480px] flex-col gap-3 p-4">
      {ZONES.map((zone, zi) => (
        <div key={zone.id}>
          {zi > 0 && (
            <div className="mb-3 flex items-center justify-center gap-2 text-gray-600">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
              <ChevronRight className="h-4 w-4 rotate-90 text-amber-500/60" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-amber-500/70">
                Process flow
              </span>
              <ChevronRight className="h-4 w-4 rotate-90 text-amber-500/60" />
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
            </div>
          )}

          <div
            className="rounded-xl border-2 p-4"
            style={{ backgroundColor: zone.bg, borderColor: zone.border }}
          >
            <div className="mb-4 flex items-center gap-3">
              <div
                className="h-8 w-1 rounded-full"
                style={{ backgroundColor: zone.color }}
              />
              <div>
                <div className="text-sm font-bold tracking-wide text-white">{zone.title}</div>
                <div className="text-[11px] text-gray-400">{zone.subtitle}</div>
              </div>
            </div>

            <div
              className={`grid gap-3 ${
                zone.codes.length === 1 ? "grid-cols-1 max-w-md mx-auto" : "grid-cols-1 sm:grid-cols-2"
              }`}
            >
              {zone.codes.map((code) => {
                const asset = byCode[code];
                const layout = GRID[code];
                if (!asset || !layout) return null;
                return (
                  <AssetCard
                    key={code}
                    asset={asset}
                    layout={layout}
                    selected={selected === code}
                    onSelect={() => onSelect?.(code)}
                    streamActive={streamActive}
                  />
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}


function SimpleIsoBlock({
  kind,
  riskColor,
  selected,
}: {
  kind: Kind;
  riskColor: string;
  selected: boolean;
}) {
  const h = kind === "blower" || kind === "crane" ? "h-14" : kind === "conveyor" ? "h-8" : "h-10";
  const w = kind === "conveyor" ? "w-16" : kind === "motor" ? "w-14" : "w-10";

  return (
    <div
      className={`plant-iso-pedestal relative ${w} ${h} transition-transform duration-200 ${
        selected ? "scale-110" : "hover:scale-105"
      }`}
      style={{
        boxShadow: selected
          ? `0 0 0 3px ${riskColor}, 0 8px 24px rgba(0,0,0,0.5)`
          : `0 0 0 2px ${riskColor}80, 0 4px 12px rgba(0,0,0,0.4)`,
      }}
    >
      <div className="plant-iso-top absolute inset-x-0 top-0 h-[45%] rounded-t-sm" />
      <div className="plant-iso-front absolute inset-x-0 bottom-0 h-[65%] rounded-b-sm" />
      <div
        className="absolute -right-1 bottom-0 top-[20%] w-[18%] rounded-r-sm"
        style={{ background: "linear-gradient(180deg,#4a5662,#2a3239)" }}
      />
      {kind === "blower" && (
        <div className="absolute left-1/2 top-[-10px] h-3 w-5 -translate-x-1/2 rounded-sm bg-slate-400" />
      )}
      {kind === "crane" && (
        <div className="absolute right-0 top-[-6px] h-1 w-8 rounded bg-slate-500" />
      )}
    </div>
  );
}

function PlantStation({
  asset,
  layout,
  selected,
  onSelect,
}: {
  asset: LiveAsset;
  layout: (typeof GRID)[string];
  selected: boolean;
  onSelect: () => void;
}) {
  const risk = RISK[asset.risk_level as keyof typeof RISK] ?? RISK.medium;
  const Icon = layout.Icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-w-0 flex-1 flex-col items-center gap-2 rounded-xl px-2 py-4 transition-all ${
        selected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
      }`}
    >
      <span
        className="flex h-10 w-10 items-center justify-center rounded-full text-base font-extrabold text-white shadow-lg"
        style={{ backgroundColor: risk.ring, boxShadow: `0 0 12px ${risk.ring}80` }}
      >
        {layout.pin}
      </span>

      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: risk.bg, color: risk.ring, border: `2px solid ${risk.ring}` }}
      >
        <Icon className="h-6 w-6" strokeWidth={2.5} />
      </div>

      <SimpleIsoBlock kind={layout.kind} riskColor={risk.ring} selected={selected} />

      <div className="w-full text-center">
        <div className="truncate text-xs font-bold text-white">{layout.short}</div>
        <div className="mt-0.5 text-lg font-extrabold tabular-nums text-white">
          {asset.health_score.toFixed(0)}%
        </div>
        <span
          className="mt-1 inline-block rounded px-2 py-0.5 text-[9px] font-bold uppercase"
          style={{ backgroundColor: risk.badge, color: risk.text }}
        >
          {risk.label}
        </span>
      </div>
    </button>
  );
}

function IsoView({
  assets,
  selected,
  onSelect,
}: {
  assets: LiveAsset[];
  selected?: string;
  onSelect?: (code: string) => void;
}) {
  const sortedStrip = useMemo(() => sortByPin(assets), [assets]);

  if (assets.length === 0) {
    return (
      <div className="flex min-h-[280px] items-center justify-center text-sm text-gray-500">
        Loading plant equipment…
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* High-contrast plant floor — all 5 stations always visible */}
      <div className="relative min-h-[300px] bg-gradient-to-b from-[#3d4f63] via-[#2a3544] to-[#1a2230] px-4 py-6">
        <div className="pointer-events-none absolute inset-x-4 bottom-10 h-20 rounded-2xl border border-white/15 bg-[#4d5a68]/60 shadow-inner" />
        <div className="pointer-events-none absolute inset-x-8 bottom-[4.5rem] flex items-center">
          <div className="h-0.5 flex-1 border-t-2 border-dashed border-amber-400/50" />
          <span className="mx-2 text-[9px] font-medium uppercase tracking-wider text-amber-400/70">
            Process flow →
          </span>
          <div className="h-0.5 flex-1 border-t-2 border-dashed border-amber-400/50" />
        </div>

        <div className="relative z-10 grid grid-cols-5 gap-2 sm:gap-4">
          {sortedStrip.map((a) => {
            const layout = GRID[a.equipment_code];
            if (!layout) return null;
            return (
              <PlantStation
                key={a.equipment_code}
                asset={a}
                layout={layout}
                selected={selected === a.equipment_code}
                onSelect={() => onSelect?.(a.equipment_code)}
              />
            );
          })}
        </div>
      </div>

      {/* Compact summary strip */}
      <div className="border-t border-white/10 bg-[#080d14] px-3 py-3">
        <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Pin order: 1 Blower · 2 Pump · 3 Motor · 4 Conveyor · 5 Crane
        </div>
        <div className="grid w-full grid-cols-5 gap-2">
          {sortedStrip.map((a) => {
            const layout = GRID[a.equipment_code];
            if (!layout) return null;
            return (
              <StripCard
                key={a.equipment_code}
                asset={a}
                layout={layout}
                selected={selected === a.equipment_code}
                onSelect={() => onSelect?.(a.equipment_code)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Plant3DScene({ assets, selected, onSelect, streamActive }: Plant3DSceneProps) {
  const [viewMode, setViewMode] = useState<"map" | "iso">("map");
  const selectedAsset = assets.find((a) => a.equipment_code === selected);
  const selectedLayout = selected ? GRID[selected] : undefined;
  const selectedRisk = selectedAsset
    ? RISK[selectedAsset.risk_level as keyof typeof RISK] ?? RISK.medium
    : null;

  return (
    <div className="plant-twin-shell relative overflow-hidden rounded-xl border border-steel-500/25 bg-gradient-to-b from-[#111a28] to-[#060a10] p-4">
      <div className="relative mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-steel-400" />
            <h3 className="text-base font-bold text-white">Steel Plant Digital Twin</h3>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Zone map = detailed zones · 3D view = all 5 machines in one row
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-white/10 bg-black/40 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                viewMode === "map" ? "bg-white/10 text-white" : "text-gray-500"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Zone Map
            </button>
            <button
              type="button"
              onClick={() => setViewMode("iso")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
                viewMode === "iso" ? "bg-white/10 text-white" : "text-gray-500"
              }`}
            >
              <Box className="h-3.5 w-3.5" /> 3D View
            </button>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
              streamActive ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-gray-400"
            }`}
          >
            {streamActive ? "● LIVE STREAM" : "○ MONITORING"}
          </span>
        </div>
      </div>

      <div className="plant-twin-viewport relative rounded-xl border border-white/10 bg-[#1a2028]">
        {viewMode === "map" ? (
          <SchematicView
            assets={assets}
            selected={selected}
            onSelect={onSelect}
            streamActive={streamActive}
          />
        ) : (
          <IsoView assets={assets} selected={selected} onSelect={onSelect} />
        )}
      </div>

      {selectedAsset && selectedLayout && selectedRisk && (
        <div
          className="mt-3 rounded-xl border-2 px-4 py-3"
          style={{ borderColor: selectedRisk.ring, backgroundColor: selectedRisk.bg }}
        >
          <div className="flex flex-wrap items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: selectedRisk.ring }}
            >
              <selectedLayout.Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold text-white">{selectedAsset.equipment_name}</span>
                <span
                  className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{ backgroundColor: selectedRisk.badge, color: selectedRisk.text }}
                >
                  {selectedRisk.label}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-300">
                <span>
                  <Activity className="mr-1 inline h-3 w-3" />
                  Health <strong className="text-white">{selectedAsset.health_score.toFixed(0)}%</strong>
                </span>
                <span>
                  RUL <strong className="text-white">{selectedAsset.rul_cycles ?? "—"}</strong> cycles
                </span>
                <span>
                  Failure prob{" "}
                  <strong className="text-white">
                    {selectedAsset.failure_probability != null
                      ? `${(selectedAsset.failure_probability * 100).toFixed(0)}%`
                      : "—"}
                  </strong>
                </span>
                <span className="text-gray-500">{selectedLayout.zoneLabel}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
