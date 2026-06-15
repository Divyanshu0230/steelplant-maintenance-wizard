"use client";

import { useEffect, useState } from "react";
import { Award, Brain, RefreshCw, Sparkles } from "lucide-react";
import AnimatedCard from "@/components/AnimatedCard";
import { api } from "@/lib/api";
import { useToast } from "@/components/ToastProvider";

type DomainProfile = {
  model_type: string;
  version?: number;
  trained_at?: string;
  training_sources?: string[];
  fault_patterns_count?: number;
  domain_vocabulary?: string[];
  bonus_merit?: { fr1_domain_fine_tuning?: boolean; method?: string; slm_layer?: string };
  feedback_stats?: {
    diagnosis_ratings_count?: number;
    average_rating?: number | null;
    feedback_boosts_applied?: number;
  };
};

export default function DomainBonusPanel() {
  const [profile, setProfile] = useState<DomainProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    api
      .getDomainProfile()
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const retrain = async () => {
    setRetraining(true);
    try {
      const res = await api.retrainDomainAdapter();
      toast("success", "Domain adapter retrained", `${res.patterns} patterns, ${res.feedback_boosts} feedback boosts`);
      load();
    } catch (e) {
      toast("error", "Retrain failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setRetraining(false);
    }
  };

  return (
    <AnimatedCard delay={150} glow>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-500/20 p-3">
            <Award className="h-7 w-7 text-amber-400" />
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold">
              FR1 Bonus — Domain-Adapted Steel Expert
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-400">
                Merit
              </span>
            </h3>
            <p className="text-sm text-gray-400">
              Fine-tuned domain SLM layer before Maintenance AI — C-MAPSS thresholds, fault codes, engineer feedback
            </p>
          </div>
        </div>
        <button
          onClick={retrain}
          disabled={retraining}
          className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm hover:bg-amber-500/20 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${retraining ? "animate-spin" : ""}`} />
          Retrain adapter
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading domain profile...</p>
      ) : profile ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
              <Brain className="h-4 w-4" />
              {profile.model_type}
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-gray-500">Fault patterns</dt>
                <dd className="font-bold text-white">{profile.fault_patterns_count ?? 0}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Trained at</dt>
                <dd className="font-medium text-gray-300">
                  {profile.trained_at ? new Date(profile.trained_at).toLocaleString() : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Diagnosis ratings</dt>
                <dd className="font-bold text-white">{profile.feedback_stats?.diagnosis_ratings_count ?? 0}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Feedback boosts</dt>
                <dd className="font-bold text-white">{profile.feedback_stats?.feedback_boosts_applied ?? 0}</dd>
              </div>
            </dl>
            <p className="text-xs text-gray-400">{profile.bonus_merit?.method}</p>
          </div>

          <div className="rounded-xl border border-[var(--border)] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-steel-500" />
              Training sources
            </div>
            <ul className="space-y-1 text-xs text-gray-400">
              {(profile.training_sources ?? []).map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
            {profile.domain_vocabulary && profile.domain_vocabulary.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {profile.domain_vocabulary.slice(0, 8).map((w) => (
                  <span key={w} className="rounded bg-steel-500/10 px-2 py-0.5 text-[10px] text-steel-400">
                    {w}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          Run <code className="text-steel-500">python scripts/train_domain_adapter.py</code> to initialize.
        </p>
      )}
    </AnimatedCard>
  );
}
