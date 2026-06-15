/**
 * Mutually exclusive fleet health buckets — aligned with backend /plant/fleet-summary.
 */
export type FleetHealthBucket = "healthy" | "warning" | "critical";

export interface HealthLike {
  health_score: number;
  risk_level: string;
}

export function classifyFleetHealth(h: HealthLike | undefined | null): FleetHealthBucket {
  if (!h) return "warning";
  const score = h.health_score;
  const risk = (h.risk_level || "medium").toLowerCase();

  if (score >= 65 && (risk === "low" || risk === "medium")) {
    return "healthy";
  }
  if (score < 45 || risk === "critical") {
    return "critical";
  }
  return "warning";
}

export function matchesHealthFilter(
  h: HealthLike | undefined | null,
  filter: "all" | FleetHealthBucket
): boolean {
  if (filter === "all") return true;
  return classifyFleetHealth(h) === filter;
}

export function fleetBucketLabel(bucket: FleetHealthBucket): string {
  return bucket;
}
