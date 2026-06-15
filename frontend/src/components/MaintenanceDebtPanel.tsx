"use client";

import Link from "next/link";
import { IndianRupee, Plus, Trash2 } from "lucide-react";
import SectionHelp from "@/components/SectionHelp";
import { LiveAsset } from "@/lib/api";
import { ManualDebtEntry } from "@/lib/liveOverrides";

type DebtItem = {
  equipment_code: string;
  debt_inr: number;
  health_score: number;
  deferred_days?: number;
};

interface MaintenanceDebtPanelProps {
  totalDebtDisplay: number;
  debtInterpretation: string;
  debtItems: DebtItem[];
  manualDebt: ManualDebtEntry[];
  assets: LiveAsset[];
  showDebtForm: boolean;
  debtForm: { equipment_code: string; debt_inr: string; note: string };
  onToggleForm: () => void;
  onDebtFormChange: (form: { equipment_code: string; debt_inr: string; note: string }) => void;
  onAddDebt: () => void;
  onRemoveManual: (id: string) => void;
  onFocusEquipment: (code: string) => void;
}

export default function MaintenanceDebtPanel({
  totalDebtDisplay,
  debtInterpretation,
  debtItems,
  manualDebt,
  assets,
  showDebtForm,
  debtForm,
  onToggleForm,
  onDebtFormChange,
  onAddDebt,
  onRemoveManual,
  onFocusEquipment,
}: MaintenanceDebtPanelProps) {
  const allCount = debtItems.length + manualDebt.length;
  const needsScroll = allCount > 4;

  return (
    <div className="flex flex-col">
      <SectionHelp
        icon={IndianRupee}
        title="Maintenance Debt"
        badge={allCount ? `${allCount} assets` : "Clear"}
        badgeClass={allCount ? "bg-red-500/15 text-red-400" : "bg-green-500/15 text-green-400"}
        help={
          debtInterpretation ||
          "Estimated production-at-risk ₹ if maintenance stays deferred on assets with health < 70%. Click an asset to focus it on Plant Twin, or open equipment detail from the amount."
        }
      />

      <div className="flex items-center justify-between gap-2">
        <div className="text-2xl font-bold text-red-400 hologram-text sm:text-3xl">
          ₹{totalDebtDisplay.toLocaleString()}
        </div>
        <button
          type="button"
          onClick={onToggleForm}
          className="flex items-center gap-1 rounded border border-steel-500/40 px-2 py-1 text-[10px] text-steel-300 hover:bg-steel-500/10"
        >
          <Plus className="h-3 w-3" /> Add manual
        </button>
      </div>

      {showDebtForm && (
        <div className="mt-2 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)]/50 p-2 text-xs">
          <select
            value={debtForm.equipment_code}
            onChange={(e) => onDebtFormChange({ ...debtForm, equipment_code: e.target.value })}
            className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1"
          >
            <option value="">Select equipment</option>
            {assets.map((a) => (
              <option key={a.equipment_code} value={a.equipment_code}>
                {a.equipment_code}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Amount ₹"
            value={debtForm.debt_inr}
            onChange={(e) => onDebtFormChange({ ...debtForm, debt_inr: e.target.value })}
            className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1"
          />
          <input
            placeholder="Note (e.g. deferred bearing replacement)"
            value={debtForm.note}
            onChange={(e) => onDebtFormChange({ ...debtForm, note: e.target.value })}
            className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1"
          />
          <button type="button" onClick={onAddDebt} className="w-full rounded bg-steel-500 py-1.5 text-xs font-medium">
            Save entry
          </button>
        </div>
      )}

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--background)]">
        <div
          className="h-full bg-gradient-to-r from-[var(--status-warning)] to-[var(--status-critical)] transition-all duration-1000"
          style={{ width: `${Math.min(100, totalDebtDisplay / 5000000 * 100)}%` }}
        />
      </div>

      {allCount > 0 ? (
        <ul
          className={`mt-2 space-y-1.5 ${needsScroll ? "max-h-[11rem] overflow-y-auto pr-0.5" : ""}`}
        >
          {debtItems.map((item) => (
            <li key={`auto-${item.equipment_code}`}>
              <div className="flex items-center justify-between gap-2 rounded border border-[var(--border)] px-2 py-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => onFocusEquipment(item.equipment_code)}
                  className="min-w-0 flex-1 text-left hover:text-white"
                >
                  <div className="font-mono text-steel-400">{item.equipment_code}</div>
                  <div className="text-gray-500">
                    Auto · health {item.health_score.toFixed(0)}%
                    {item.deferred_days != null && ` · ${item.deferred_days}d deferred`}
                  </div>
                </button>
                <Link
                  href={`/equipment/${item.equipment_code}`}
                  className="shrink-0 font-bold text-red-400 hover:underline"
                >
                  ₹{item.debt_inr.toLocaleString()}
                </Link>
              </div>
            </li>
          ))}
          {manualDebt.map((item) => (
            <li key={item.id}>
              <div className="flex items-center justify-between gap-2 rounded border border-steel-500/30 bg-steel-500/5 px-2 py-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => onFocusEquipment(item.equipment_code)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="font-mono text-steel-400">{item.equipment_code}</div>
                  <div className="truncate text-gray-500">Manual · {item.note}</div>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-bold text-red-400">₹{item.debt_inr.toLocaleString()}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveManual(item.id)}
                    className="text-gray-500 hover:text-red-400"
                    aria-label="Remove manual entry"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-green-400">No debt — add manual entries if work was deferred.</p>
      )}
    </div>
  );
}
