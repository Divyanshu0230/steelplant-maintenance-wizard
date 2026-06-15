"use client";

import { Database, Info } from "lucide-react";

export default function DataSourceBanner() {
  return (
    <div className="rounded-xl border border-steel-500/30 bg-gradient-to-r from-steel-500/10 to-transparent p-4">
      <div className="flex items-start gap-3">
        <Database className="mt-0.5 h-5 w-5 shrink-0 text-steel-500" />
        <div className="text-sm">
          <div className="font-semibold text-gray-200">Where does the data come from?</div>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">
            Sensor readings are <strong className="text-gray-300">real NASA C-MAPSS FD001</strong> turbofan
            degradation data (public research dataset), mapped to 5 Tata steel plant equipment units.
            Charts scale C-MAPSS magnitudes into plausible plant units (°C, mm/s, bar, A) for display — ML still trains on raw data.
            ML models (Isolation Forest + RUL) are trained on this data. When you click{" "}
            <strong className="text-steel-500">Simulate Cycle</strong> or{" "}
            <strong className="text-steel-500">Failure Demo</strong>, new sensor points are appended
            and graphs update live — that is simulated progression on top of real baseline data.
          </p>
          <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-500">
            <Info className="h-3 w-3" />
            Reference hackathon projects use fully synthetic data — ours uses a published ML benchmark dataset.
          </div>
        </div>
      </div>
    </div>
  );
}
