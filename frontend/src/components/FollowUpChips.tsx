"use client";

function FollowUpChips({
  items,
  onSelect,
  disabled,
}: {
  items: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}) {
  if (!items.length) return null;

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        Follow-up — tap to ask
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((fq) => (
          <button
            key={fq}
            type="button"
            onClick={() => onSelect(fq)}
            disabled={disabled}
            className="chat-followup-chip rounded-full border border-status-healthy/35 bg-status-healthy/10 px-3 py-1.5 text-left text-[11px] font-medium text-status-healthy transition hover:bg-status-healthy/20 disabled:opacity-50"
          >
            {fq}
          </button>
        ))}
      </div>
    </div>
  );
}

export default FollowUpChips;
