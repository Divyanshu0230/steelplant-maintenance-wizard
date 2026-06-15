import { api, ChatResponse, DiagnosisResult } from "@/lib/api";

export type DiagnosisReportPayload = {
  equipment_code: string;
  equipment_name?: string;
  answer: string;
  probable_causes?: ChatResponse["probable_causes"];
  maintenance_actions?: ChatResponse["maintenance_actions"];
  spare_recommendations?: Record<string, unknown>[];
  risk_level?: string;
  failure_probability?: number;
  rul_cycles?: number;
  confidence_score?: number;
};

export function payloadFromChatResponse(
  response: ChatResponse,
  equipmentCode: string,
  equipmentName?: string
): DiagnosisReportPayload {
  return {
    equipment_code: equipmentCode,
    equipment_name: equipmentName ?? response.context_snapshot?.equipment_name,
    answer: response.answer,
    probable_causes: response.probable_causes,
    maintenance_actions: response.maintenance_actions,
    spare_recommendations: response.spare_recommendations,
    risk_level: response.risk_level,
    failure_probability: response.failure_probability,
    rul_cycles: response.rul_cycles,
    confidence_score: response.confidence_score,
  };
}

export function payloadFromDiagnosisResult(
  result: DiagnosisResult,
  equipmentCode: string,
  equipmentName?: string
): DiagnosisReportPayload {
  return {
    equipment_code: equipmentCode,
    equipment_name: equipmentName,
    answer: result.diagnosis,
    probable_causes: result.probable_causes.map((c) => ({
      cause: c.cause,
      confidence: c.confidence,
      evidence: c.evidence ?? "",
    })),
    maintenance_actions: result.maintenance_actions.map((a) => ({
      priority: a.priority,
      action: a.action,
      timeframe: a.timeframe ?? "",
      rationale: a.rationale ?? "",
    })),
    spare_recommendations: result.spare_recommendations as Record<string, unknown>[],
    risk_level: result.risk_level,
    failure_probability: result.failure_probability,
    rul_cycles: result.rul_cycles,
    confidence_score: result.confidence_score,
  };
}

export async function downloadDiagnosisReportPdf(payload: DiagnosisReportPayload): Promise<void> {
  const blob = await api.exportDiagnosisPdf(payload);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Maintenance_Report_${payload.equipment_code}_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
