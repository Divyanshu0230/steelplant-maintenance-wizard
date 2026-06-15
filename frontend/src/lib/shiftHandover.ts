export type HandoverReviewRecord = {
  fingerprint: string;
  reviewedAt: string;
  logbookSaved: boolean;
  alertCount: number;
  criticalCount: number;
  bottleneckCode: string | null;
};

const REVIEW_KEY = "steelplant-handover-review";
const NOTES_KEY = "steelplant-shift-handover-notes";

export function handoverFingerprint(
  alertCount: number,
  criticalCount: number,
  bottleneckCode: string | null,
  criticalAlerts: { equipment_code: string; title: string }[]
): string {
  return [
    alertCount,
    criticalCount,
    bottleneckCode ?? "",
    ...criticalAlerts.map((a) => `${a.equipment_code}:${a.title}`),
  ].join("|");
}

export function getHandoverReview(): HandoverReviewRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REVIEW_KEY);
    return raw ? (JSON.parse(raw) as HandoverReviewRecord) : null;
  } catch {
    return null;
  }
}

export function saveHandoverReview(record: HandoverReviewRecord) {
  localStorage.setItem(REVIEW_KEY, JSON.stringify(record));
}

export function clearHandoverReview() {
  localStorage.removeItem(REVIEW_KEY);
}

export function clearHandoverNotes() {
  localStorage.removeItem(NOTES_KEY);
}

export function getHandoverNotes(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NOTES_KEY) ?? "";
}

export function saveHandoverNotes(notes: string) {
  localStorage.setItem(NOTES_KEY, notes);
}

export function isHandoverReviewedFor(fingerprint: string): HandoverReviewRecord | null {
  const record = getHandoverReview();
  if (record?.fingerprint === fingerprint) return record;
  return null;
}
