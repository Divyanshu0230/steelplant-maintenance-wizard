"use client";

import { useEffect, useState } from "react";
import { Brain, ThumbsUp } from "lucide-react";
import AnimatedCard from "./AnimatedCard";
import { api, FeedbackInsights as Insights } from "@/lib/api";

export default function FeedbackInsightsPanel() {
  const [insights, setInsights] = useState<Insights | null>(null);

  useEffect(() => {
    api.getFeedbackInsights().then(setInsights).catch(() => setInsights(null));
  }, []);

  if (!insights || insights.total_feedback === 0) return null;

  return (
    <AnimatedCard delay={320}>
      <div className="mb-3 flex items-center gap-2">
        <Brain className="h-5 w-5 text-steel-500" />
        <h2 className="font-semibold">AI Learning Insights</h2>
        <span className="ml-auto rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
          {insights.total_feedback} feedback entries
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--border)] p-3">
          <div className="text-xs text-gray-500">Confirmed diagnoses</div>
          <div className="mt-1 text-lg font-bold text-green-400">{insights.confirmed_count}</div>
        </div>
        <div className="rounded-lg border border-[var(--border)] p-3">
          <div className="text-xs text-gray-500">Engineer corrections</div>
          <div className="mt-1 text-lg font-bold text-yellow-400">{insights.correction_count}</div>
        </div>
        <div className="rounded-lg border border-[var(--border)] p-3">
          <div className="text-xs text-gray-500">Helpful ratings</div>
          <div className="mt-1 flex items-center gap-1 text-lg font-bold text-steel-400">
            <ThumbsUp className="h-4 w-4" />
            {insights.helpful_count}
          </div>
        </div>
      </div>
      {insights.recent_learnings.length > 0 && (
        <div className="mt-3 space-y-1">
          {insights.recent_learnings.slice(0, 3).map((item, i) => (
            <div
              key={i}
              className="rounded border border-[var(--border)] px-3 py-2 text-xs text-gray-400"
            >
              <span className="font-medium text-gray-300">{item.type}:</span> {item.text}
            </div>
          ))}
        </div>
      )}
    </AnimatedCard>
  );
}
