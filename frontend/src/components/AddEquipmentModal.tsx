"use client";

import { useState } from "react";
import { Cpu, Plus, X } from "lucide-react";
import { api, Equipment } from "@/lib/api";

const EQUIPMENT_TYPES = [
  { value: "blast_furnace_blower", label: "Blast furnace blower" },
  { value: "rolling_mill_motor", label: "Rolling mill motor" },
  { value: "conveyor_system", label: "Conveyor system" },
  { value: "overhead_crane", label: "Overhead crane" },
  { value: "cooling_pump", label: "Cooling pump" },
  { value: "compressor", label: "Compressor" },
  { value: "fan_unit", label: "Fan unit" },
  { value: "hydraulic_unit", label: "Hydraulic unit" },
];

const LOCATIONS = [
  "Blast Furnace Area",
  "Hot Rolling Mill",
  "Raw Material Handling",
  "Melting Shop",
  "Utilities",
  "Plant",
];

const CRITICALITY = ["low", "medium", "high", "critical"] as const;

interface AddEquipmentModalProps {
  onClose: () => void;
  onCreated: (equipment: Equipment) => void;
}

export default function AddEquipmentModal({ onClose, onCreated }: AddEquipmentModalProps) {
  const [equipmentCode, setEquipmentCode] = useState("");
  const [name, setName] = useState("");
  const [equipmentType, setEquipmentType] = useState(EQUIPMENT_TYPES[0].value);
  const [location, setLocation] = useState(LOCATIONS[0]);
  const [criticality, setCriticality] = useState<(typeof CRITICALITY)[number]>("medium");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createEquipment({
        equipment_code: equipmentCode.trim(),
        name: name.trim(),
        equipment_type: equipmentType,
        location,
        criticality,
      });
      onCreated(created);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add equipment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-[var(--status-healthy)]" />
              <h3 className="font-bold">Add Equipment</h3>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Register a new asset — baseline sensors and health score are created automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--muted)] hover:bg-[var(--nav-active)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            Equipment code
            <input
              value={equipmentCode}
              onChange={(e) => setEquipmentCode(e.target.value.toUpperCase())}
              placeholder="e.g. RM-MOTOR-07"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            Display name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rolling Mill Motor 07"
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            Type
            <select
              value={equipmentType}
              onChange={(e) => setEquipmentType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              {EQUIPMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Criticality
            <select
              value={criticality}
              onChange={(e) => setCriticality(e.target.value as (typeof CRITICALITY)[number])}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm capitalize"
            >
              {CRITICALITY.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            Plant zone / location
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            >
              {LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-[var(--status-critical)]">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !equipmentCode.trim() || !name.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--btn-bg)] py-2.5 text-sm font-medium text-[var(--btn-fg)] disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {submitting ? "Adding…" : "Add to fleet"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
