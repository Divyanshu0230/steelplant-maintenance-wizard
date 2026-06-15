"use client";

import { X } from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import { KnowledgeDocumentDetail } from "@/lib/api";

interface DocumentViewerProps {
  doc: KnowledgeDocumentDetail | null;
  loading?: boolean;
  onClose: () => void;
}

export default function DocumentViewer({ doc, loading, onClose }: DocumentViewerProps) {
  if (!doc && !loading) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-scale-in max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h3 className="font-bold">{doc?.title ?? "Loading document..."}</h3>
            {doc && (
              <p className="text-xs text-gray-500">
                {doc.document_type} · {doc.equipment_type || "general"} · {doc.chunk_count} chunks
                {doc.source_filename && ` · ${doc.source_filename}`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-[var(--background)] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(85vh-80px)] overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-4 rounded" />
              ))}
            </div>
          ) : doc ? (
            <div className="prose-sm text-sm text-gray-300">
              <MarkdownRenderer content={doc.content} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
