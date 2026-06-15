import { clearAuth, getToken, setToken, setUser, AuthUser } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/api/v1/ws/monitoring";
const CHAT_TIMEOUT_MS = 120000;
const LOGIN_TIMEOUT_MS = 120000;
const COLD_START_HOSTS = ["onrender.com"];
const DEFAULT_TIMEOUT_MS = COLD_START_HOSTS.some((h) => API_BASE.includes(h)) ? 90000 : 30000;

type FetchOptions = RequestInit & { skipAuthRedirect?: boolean };

async function fetchApi<T>(path: string, options?: FetchOptions, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const { skipAuthRedirect, ...fetchOptions } = options || {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const token = getToken();

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...fetchOptions?.headers,
      },
    });
    if (res.status === 401) {
      const errText401 = await res.text();
      let msg = "Unauthorized";
      try {
        const parsed = JSON.parse(errText401);
        msg = typeof parsed.detail === "string" ? parsed.detail : msg;
      } catch {
        /* use default */
      }
      if (!skipAuthRedirect && typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        // Only force re-login for explicit session expiry — not transient backend overload
        const sessionExpired =
          msg.toLowerCase().includes("expired") ||
          msg.toLowerCase().includes("invalid") ||
          msg.toLowerCase().includes("credentials");
        if (sessionExpired) {
          clearAuth();
          window.location.href = "/login";
        }
        throw new Error(sessionExpired ? "Session expired. Please login again." : msg);
      }
      throw new Error(msg);
    }
    if (!res.ok) {
      const errText = await res.text();
      try {
        const parsed = JSON.parse(errText);
        const detail = parsed.detail;
        throw new Error(
          typeof detail === "string" ? detail : JSON.stringify(detail) || errText
        );
      } catch (e) {
        if (e instanceof Error && !e.message.startsWith("{") && e.message !== errText) throw e;
        throw new Error(errText || `API error ${res.status}`);
      }
    }
    if (res.headers.get("content-type")?.includes("application/pdf")) {
      return res.blob() as unknown as T;
    }
    return res.json();
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      const coldStart = COLD_START_HOSTS.some((h) => API_BASE.includes(h));
      throw new Error(
        coldStart
          ? "Server is waking up (Render free tier). Wait ~60 seconds and try again."
          : "Request timed out. Please try again."
      );
    }
    if (e instanceof TypeError && e.message.includes("fetch")) {
      throw new Error(
        "Cannot reach backend. Start the API server: cd backend && uvicorn app.main:app --port 8000"
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export interface Equipment {
  id: number;
  equipment_code: string;
  name: string;
  equipment_type: string;
  location?: string;
  criticality: string;
  status: string;
}

export interface EquipmentCreatePayload {
  equipment_code: string;
  name: string;
  equipment_type: string;
  location?: string;
  criticality?: string;
  manufacturer?: string;
  model?: string;
}

export interface EquipmentHealth {
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  health_score: number;
  anomaly_score?: number;
  risk_level: string;
  failure_probability?: number;
  rul_cycles?: number;
}

export interface PredictionResult {
  equipment_id: number;
  failure_probability: number;
  rul_cycles: number;
  degradation_score: number;
  risk_level: string;
  anomaly_detected: boolean;
  contributing_factors?: string[];
}

export interface KnowledgeDocument {
  id: number;
  title: string;
  document_type: string;
  equipment_type?: string;
  chunk_count: number;
}

export interface KnowledgeDocumentDetail extends KnowledgeDocument {
  file_path?: string;
  source_filename?: string;
  content: string;
}

export interface SavedKnowledgeAnswer {
  id: number;
  question: string;
  answer: string;
  citations: { source: string; document_type: string; excerpt: string; relevance_score: number }[];
  role?: string;
  view_mode: string;
  saved_at: string;
  saved_by?: string;
  source_documents: string[];
}

export interface Alert {
  id: number;
  equipment_id?: number;
  alert_level: string;
  title: string;
  message: string;
  source?: string;
  is_acknowledged: boolean;
  is_resolved?: boolean;
  resolution_type?: string;
  resolution_notes?: string;
  resolved_at?: string;
  created_at: string;
}

export interface AlertResolvePayload {
  resolution_type: string;
  resolution_notes?: string;
}

export interface SensorHistoryPoint {
  timestamp: string;
  cycle?: number;
  temperature?: number;
  vibration?: number;
  pressure?: number;
  motor_current?: number;
  health_indicator?: number;
  data_source?: string;
}

export interface ChatResponse {
  conversation_id: number;
  answer: string;
  probable_causes: { cause: string; confidence: number; evidence: string }[];
  risk_level: string;
  failure_probability?: number;
  rul_cycles?: number;
  maintenance_actions: { priority: string; action: string; timeframe: string; rationale: string }[];
  spare_recommendations: Record<string, unknown>[];
  citations: { source: string; document_type: string; excerpt: string; relevance_score: number }[];
  alerts_generated: string[];
  confidence_score: number;
  ai_mode?: string;
  follow_up_suggestions?: string[];
  agent_steps?: string[];
  intent?: "greeting" | "navigation" | "general" | "maintenance";
  navigation_links?: { label: string; route: string }[];
  response_source?: string;
  context_snapshot?: {
    equipment_code?: string;
    equipment_name?: string;
    location?: string;
    criticality?: string;
    sensor_readings?: Record<string, number>;
    data_source?: string;
    anomaly_detected?: boolean;
    ai_engine?: string;
    using_full_llm?: boolean;
  };
}

export interface AiStatus {
  gemini_configured: boolean;
  gemini_key_valid_format: boolean;
  gemini_ready: boolean;
  quota_cooldown_seconds: number;
  model: string;
  enable_full_agentic: boolean;
  deployment_hint: string;
  last_ai_mode?: string;
  provider?: string;
  fallback_order?: string[];
  providers?: Record<
    string,
    { configured: boolean; ready: boolean; cooldown_seconds: number; model: string }
  >;
  any_llm_ready?: boolean;
  primary_ready?: string | null;
}

export interface FleetSummary {
  total_assets: number;
  healthy_assets: number;
  warning_assets: number;
  critical_assets: number;
  active_alerts: number;
  data_source: string;
  ml_models: string[];
}

export interface CommandCenter {
  plant_bottleneck: {
    equipment_code: string;
    equipment_name: string;
    health_score: number;
    risk_level: string;
    priority_score: number;
    recommended_action: string;
  } | null;
  equipment_priority: Array<{
    equipment_code: string;
    health_score: number;
    risk_level: string;
    priority_score: number;
    recommended_action: string;
  }>;
  critical_alert_count: number;
  active_alerts: number;
  low_stock_parts: Array<{ part_code: string; name: string; qty: number; min: number }>;
  top_recommendation: string;
}

export interface SparePart {
  id: number;
  part_code: string;
  name: string;
  equipment_type?: string;
  quantity_available: number;
  minimum_stock: number;
  unit_cost?: number;
  supplier?: string;
  lead_time_days: number;
}

export interface SparePartsSummary {
  total_parts: number;
  low_stock_count: number;
  out_of_stock_count: number;
  healthy_count: number;
  inventory_value: number;
  pending_procurement: number;
  by_equipment_type: Record<string, { total: number; low: number; out: number }>;
  critical_parts: Array<{
    part_code: string;
    name: string;
    quantity_available: number;
    minimum_stock: number;
    equipment_type?: string;
  }>;
}

export interface ProcurementItem {
  id: number;
  spare_part_id?: number;
  quantity_requested: number;
  urgency: string;
  status: string;
  notes?: string;
  created_at?: string;
  part_code?: string;
  part_name?: string;
  unit_cost?: number;
  lead_time_days?: number;
  equipment_type?: string;
  estimated_cost?: number;
}

export interface ProcurementSummary {
  total_requests: number;
  pending: number;
  approved: number;
  rejected: number;
  critical_pending: number;
  pending_estimated_cost: number;
  by_status: Record<string, number>;
  by_urgency_pending: Record<string, number>;
}

export interface LogbookEntry {
  id: number;
  equipment_id: number;
  equipment_code?: string;
  equipment_name?: string;
  maintenance_type: string;
  performed_at: string;
  performed_by?: string;
  description: string;
  parts_used?: string;
  outcome?: string;
  duration_hours?: number;
  cost?: number;
}

export interface LogbookSummary {
  total_entries: number;
  last_8_hours: number;
  last_24_hours: number;
  by_type: Record<string, number>;
  by_equipment: Record<string, number>;
}

export interface ReportSummary {
  id: number;
  title: string;
  report_type: string;
  equipment_id?: number;
  equipment_code?: string;
  equipment_name?: string;
  generated_by?: string;
  created_at: string;
  risk_level?: string;
  summary_preview?: string;
}

export interface ReportDetail extends ReportSummary {
  content?: Record<string, unknown>;
}

export interface ReportsSummaryStats {
  total_reports: number;
  last_24_hours: number;
  last_7_days: number;
  by_type: Record<string, number>;
  by_equipment: Record<string, number>;
  latest_at?: string;
}

export interface ConversationSummary {
  id: number;
  title?: string;
  equipment_id?: number;
  created_at: string;
  message_count: number;
}

export interface FeedbackInsights {
  total_feedback: number;
  helpful_count: number;
  correction_count: number;
  confirmed_count: number;
  recent_learnings: { type: string; text: string; equipment: string }[];
}

export interface LiveAsset {
  equipment_code: string;
  equipment_name: string;
  location?: string;
  health_score: number;
  risk_level: string;
  rul_cycles?: number;
  failure_probability?: number;
  last_cycle?: number;
  last_reading_at?: string;
  data_source?: string;
  live_simulated?: boolean;
  pulse: string;
}

export interface MonitoringEvent {
  id: number;
  type: string;
  message: string;
  equipment_code?: string;
  severity: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface OperationalSummary {
  delay_log_count: number;
  active_fault_count: number;
  fault_code_dictionary_size: number;
  total_recent_delay_hours: number;
  data_sources: string[];
}

export interface DelayLog {
  id: number;
  equipment_code: string;
  equipment_name: string;
  logged_at: string;
  delay_hours: number;
  production_loss_tonnes: number;
  reason: string;
  severity: string;
}

export interface FaultMessage {
  id: number;
  equipment_code: string;
  fault_code: string;
  message: string;
  severity: string;
  source: string;
  logged_at: string;
  is_active: boolean;
}

export interface FaultCode {
  fault_code: string;
  equipment_type: string;
  description: string;
  severity: string;
  recommended_action: string;
}

export interface SpareRecommendation {
  part?: string;
  part_name?: string;
  name?: string;
  part_code?: string;
  quantity_available?: number;
  minimum_stock?: number;
  quantity_recommended?: number;
  urgency?: string;
  lead_time_days?: number;
  unit_cost?: number;
  equipment_type?: string;
  stock_status?: string;
  rationale?: string;
}

export interface ProcessDefect {
  defect: string;
  confidence: number;
  indicators: string[];
  action: string;
}

export interface ProcessDefectsResult {
  equipment_code: string;
  equipment_type: string;
  sensor_snapshot: Record<string, number>;
  process_defects: ProcessDefect[];
  source: string;
}

export interface MaintenancePlan {
  equipment_code: string;
  urgency: string;
  immediate_actions: string[];
  optimized_maintenance_plan: string[];
  long_term_monitoring: string[];
  spare_procurement_strategy: string[];
  process_defects: ProcessDefect[];
  delay_severity_score: number;
  recent_downtime_hours_30d: number;
  priority_factors: Record<string, number | string>;
}

export interface DiagnosisResult {
  equipment_code?: string;
  diagnosis: string;
  probable_causes: { cause: string; confidence: number; evidence?: string }[];
  maintenance_actions: { priority: string; action: string; timeframe?: string; rationale?: string }[];
  risk_level?: string;
  failure_probability?: number;
  rul_cycles?: number;
  confidence_score?: number;
  process_defects: ProcessDefect[];
  spare_recommendations: SpareRecommendation[];
  citations: {
    source: string;
    document_type?: string;
    excerpt?: string;
    relevance_score?: number;
  }[];
  fault_description?: string;
  explainability?: Record<string, unknown>;
}

export interface PriorityRankingRow {
  equipment_code: string;
  equipment_name: string;
  criticality: string;
  health_score: number;
  risk_level: string;
  rul_cycles?: number;
  failure_probability?: number;
  priority_score: number;
  delay_hours_30d: number;
  delay_severity_score: number;
  recommended_action: string;
  spares_low_stock?: number;
  spares_available?: number;
}

export function getWebSocketUrl() {
  return WS_BASE;
}

export const api = {
  login: async (email: string, password: string) => {
    const res = await fetchApi<{
      access_token: string;
      user: AuthUser;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      skipAuthRedirect: true,
    }, LOGIN_TIMEOUT_MS);
    setToken(res.access_token);
    setUser(res.user);
    return res.user;
  },
  me: () => fetchApi<AuthUser>("/auth/me"),
  getEquipment: () => fetchApi<Equipment[]>("/equipment"),
  createEquipment: (payload: EquipmentCreatePayload) =>
    fetchApi<Equipment>("/equipment", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getHealth: () => fetchApi<EquipmentHealth[]>("/equipment/health"),
  predictEquipment: (equipmentId: number) =>
    fetchApi<PredictionResult>(`/equipment/${equipmentId}/predict`),
  getFleetSummary: () => fetchApi<FleetSummary>("/plant/fleet-summary"),
  getCommandCenter: () => fetchApi<CommandCenter>("/plant/command-center"),
  getPriorityRanking: () =>
    fetchApi<{ ranking: PriorityRankingRow[]; methodology: string; data_sources: string[] }>(
      "/plant/priority-ranking"
    ),
  simulateSensorTick: (equipmentId: number) =>
    fetchApi<{ equipment_id: number; cycle: number }>(
      `/sensors/simulate-tick?equipment_id=${equipmentId}`,
      { method: "POST" }
    ),
  getAlerts: (roleFilter = true, unresolvedOnly = true, limit = 200) =>
    fetchApi<Alert[]>(
      `/alerts?role_filter=${roleFilter}${unresolvedOnly ? "&unresolved_only=true" : ""}&limit=${limit}`
    ),
  acknowledgeAlert: (id: number) =>
    fetchApi(`/alerts/${id}/acknowledge`, { method: "POST" }),
  resolveAlert: (id: number, payload: AlertResolvePayload) =>
    fetchApi<Alert>(`/alerts/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getSensorHistory: (equipmentCode: string, limit = 120) =>
    fetchApi<SensorHistoryPoint[]>(
      `/sensors/history?equipment_code=${encodeURIComponent(equipmentCode)}&limit=${limit}`
    ),
  chat: (
    message: string,
    options?: {
      equipmentCode?: string;
      conversationId?: number;
      currentPage?: string;
      chatMode?: "assistant" | "diagnosis";
      useFullAgents?: boolean;
    }
  ) =>
    fetchApi<ChatResponse>(
      "/chat",
      {
        method: "POST",
        body: JSON.stringify({
          message,
          equipment_code: options?.equipmentCode,
          conversation_id: options?.conversationId,
          current_page: options?.currentPage,
          chat_mode: options?.chatMode ?? "assistant",
          use_full_agents: options?.useFullAgents ?? true,
        }),
      },
      CHAT_TIMEOUT_MS
    ),
  getAiStatus: () => fetchApi<AiStatus>("/ai/status"),
  getConversations: () => fetchApi<ConversationSummary[]>("/conversations"),
  getConversationMessages: (id: number) =>
    fetchApi<{ id: number; role: string; content: string; created_at: string }[]>(
      `/conversations/${id}/messages`
    ),
  submitFeedback: (data: {
    conversation_id?: number;
    equipment_id?: number;
    feedback_type: string;
    correction?: string;
    original_recommendation?: string;
    rating?: number;
    outcome?: string;
  }) =>
    fetchApi("/feedback", { method: "POST", body: JSON.stringify(data) }),
  getFeedbackInsights: () => fetchApi<FeedbackInsights>("/feedback/insights"),
  getSpareParts: (params?: {
    lowStockOnly?: boolean;
    equipmentType?: string;
    search?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.lowStockOnly) q.set("low_stock_only", "true");
    if (params?.equipmentType) q.set("equipment_type", params.equipmentType);
    if (params?.search) q.set("search", params.search);
    const qs = q.toString();
    return fetchApi<SparePart[]>(`/spare-parts${qs ? `?${qs}` : ""}`);
  },
  getSparePartsSummary: () => fetchApi<SparePartsSummary>("/spare-parts/summary"),
  getSpareRecommendations: (equipmentCode?: string) =>
    fetchApi<{
      equipment_code?: string;
      equipment_name?: string;
      equipment_type?: string;
      risk_level: string;
      failure_probability: number;
      recommendations: SpareRecommendation[];
    }>(
      `/spare-parts/recommendations${equipmentCode ? `?equipment_code=${encodeURIComponent(equipmentCode)}` : ""}`
    ),
  createSparePart: (data: {
    part_code: string;
    name: string;
    equipment_type?: string;
    quantity_available?: number;
    minimum_stock?: number;
    unit_cost?: number;
    supplier?: string;
    lead_time_days?: number;
  }) => fetchApi<SparePart>("/spare-parts", { method: "POST", body: JSON.stringify(data) }),
  requestNewSparePart: (data: {
    part_code: string;
    name: string;
    equipment_type?: string;
    quantity_requested: number;
    minimum_stock?: number;
    unit_cost?: number;
    supplier?: string;
    lead_time_days?: number;
    urgency?: string;
    equipment_id?: number;
    notes?: string;
  }) =>
    fetchApi<{ status: string; created_new_part: boolean; procurement_id: number; message: string }>(
      "/spare-parts/request-new",
      { method: "POST", body: JSON.stringify(data) }
    ),
  updateSparePart: (id: number, data: { quantity_available?: number }) =>
    fetchApi(`/spare-parts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  getProcurement: (params?: { status?: string; urgency?: string; search?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.urgency) q.set("urgency", params.urgency);
    if (params?.search) q.set("search", params.search);
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return fetchApi<ProcurementItem[]>(`/procurement${qs ? `?${qs}` : ""}`);
  },
  getProcurementSummary: () => fetchApi<ProcurementSummary>("/procurement/summary"),
  approveAllPendingProcurement: (urgency?: string) =>
    fetchApi<{ approved: number; message: string }>(
      `/procurement/approve-pending${urgency ? `?urgency=${urgency}` : ""}`,
      { method: "POST" }
    ),
  exportProcurementPdf: (status?: string) =>
    fetchApi<Blob>(
      `/procurement/export-pdf${status ? `?status=${encodeURIComponent(status)}` : ""}`,
      { method: "POST" }
    ),
  createProcurement: (data: {
    spare_part_id: number;
    equipment_id?: number;
    quantity_requested: number;
    urgency?: string;
    notes?: string;
  }) =>
    fetchApi<{ id: number; status: string }>("/procurement", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  approveProcurement: (id: number) =>
    fetchApi(`/procurement/${id}/approve`, { method: "PATCH" }),
  rejectProcurement: (id: number, reason?: string) =>
    fetchApi(`/procurement/${id}/reject`, {
      method: "PATCH",
      body: JSON.stringify({ reason: reason || undefined }),
    }),
  getLogbook: (params?: {
    equipmentCode?: string;
    maintenanceType?: string;
    search?: string;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.equipmentCode) q.set("equipment_code", params.equipmentCode);
    if (params?.maintenanceType) q.set("maintenance_type", params.maintenanceType);
    if (params?.search) q.set("search", params.search);
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return fetchApi<LogbookEntry[]>(`/logbook${qs ? `?${qs}` : ""}`);
  },
  getLogbookSummary: (equipmentCode?: string) =>
    fetchApi<LogbookSummary>(
      `/logbook/summary${equipmentCode ? `?equipment_code=${encodeURIComponent(equipmentCode)}` : ""}`
    ),
  createLogbookEntry: (data: {
    equipment_code: string;
    description: string;
    maintenance_type?: string;
    parts_used?: string;
    duration_hours?: number;
    cost?: number;
    outcome?: string;
  }) =>
    fetchApi<LogbookEntry>("/logbook", { method: "POST", body: JSON.stringify(data) }),
  exportLogbookPdf: (equipmentCode?: string) =>
    fetchApi<Blob>(
      `/logbook/export-pdf${equipmentCode ? `?equipment_code=${encodeURIComponent(equipmentCode)}` : ""}`,
      { method: "POST" }
    ),
  listReports: (params?: {
    limit?: number;
    reportType?: string;
    equipmentCode?: string;
    search?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.reportType) q.set("report_type", params.reportType);
    if (params?.equipmentCode) q.set("equipment_code", params.equipmentCode);
    if (params?.search) q.set("search", params.search);
    const qs = q.toString();
    return fetchApi<ReportSummary[]>(`/reports${qs ? `?${qs}` : ""}`);
  },
  getReportsSummary: () => fetchApi<ReportsSummaryStats>("/reports/summary"),
  getReport: (id: number) => fetchApi<ReportDetail>(`/reports/${id}`),
  generateReport: (equipmentCode: string, reportType = "maintenance_summary") =>
    fetchApi<Record<string, unknown>>(
      "/reports/generate",
      {
        method: "POST",
        body: JSON.stringify({
          report_type: reportType,
          equipment_code: equipmentCode,
        }),
      },
      CHAT_TIMEOUT_MS
    ),
  generateShiftBriefingPdf: () =>
    fetchApi<Blob>("/reports/shift-briefing", { method: "POST" }, 60000),
  downloadReportPdf: (id: number) => fetchApi<Blob>(`/reports/${id}/pdf`),
  exportDiagnosisPdf: (payload: {
    equipment_code: string;
    equipment_name?: string;
    answer: string;
    probable_causes?: { cause: string; confidence: number; evidence: string }[];
    maintenance_actions?: { priority: string; action: string; timeframe: string; rationale: string }[];
    spare_recommendations?: Record<string, unknown>[];
    risk_level?: string;
    failure_probability?: number;
    rul_cycles?: number;
    confidence_score?: number;
  }) =>
    fetchApi<Blob>(
      "/reports/export-pdf",
      { method: "POST", body: JSON.stringify(payload) },
      CHAT_TIMEOUT_MS
    ),
  getKnowledgeDocuments: () => fetchApi<KnowledgeDocument[]>("/knowledge/documents"),
  getKnowledgeDocument: (id: number) =>
    fetchApi<KnowledgeDocumentDetail>(`/knowledge/documents/${id}`),
  getKnowledgeDocumentBySource: (sourceName: string) =>
    fetchApi<KnowledgeDocumentDetail>(
      `/knowledge/documents/by-source/${encodeURIComponent(sourceName)}`
    ),
  ingestKnowledge: () =>
    fetchApi<{ status: string; documents_ingested?: number; chunks_created?: number }>(
      "/knowledge/ingest",
      { method: "POST" },
      120000
    ),
  searchKnowledge: (query: string, equipmentType?: string) =>
    fetchApi<{ text: string; score: number; metadata: Record<string, string> }[]>(
      `/knowledge/search?query=${encodeURIComponent(query)}${equipmentType ? `&equipment_type=${equipmentType}` : ""}`
    ),
    getKnowledgeAIAnswer: (question: string, equipmentType?: string, role?: string) =>
    fetchApi<{
      answer: string;
      citations: { source: string; document_type: string; excerpt: string; relevance_score: number }[];
      domain_model_active: boolean;
      role_context?: string;
      ai_mode?: string;
      sources_matched?: number;
    }>("/knowledge/ai-answer", {
      method: "POST",
      body: JSON.stringify({ question, equipment_type: equipmentType, role }),
    }),
  saveKnowledgeAnswer: (data: {
    question: string;
    answer: string;
    citations?: { source: string; document_type: string; excerpt: string; relevance_score: number }[];
    role?: string;
    view_mode?: string;
  }) =>
    fetchApi<SavedKnowledgeAnswer>("/knowledge/saved", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getSavedKnowledgeAnswers: () => fetchApi<SavedKnowledgeAnswer[]>("/knowledge/saved"),
  deleteSavedKnowledgeAnswer: (id: number) =>
    fetchApi<{ status: string; id: number }>(`/knowledge/saved/${id}`, { method: "DELETE" }),
  getDomainProfile: () =>
    fetchApi<{
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
    }>("/domain/profile"),
  retrainDomainAdapter: () =>
    fetchApi<{ status: string; patterns: number; feedback_boosts: number; trained_at: string }>(
      "/domain/retrain",
      { method: "POST" }
    ),
  getLiveMonitoringStatus: () =>
    fetchApi<{
      monitoring_active: boolean;
      scan_interval_seconds: number;
      last_scan: { timestamp?: string; stats?: Record<string, number> };
      assets: LiveAsset[];
    }>("/monitoring/status"),
  getMonitoringEvents: (limit = 40) =>
    fetchApi<{ events: MonitoringEvent[] }>(`/monitoring/event-feed?limit=${limit}`),
  getShiftBriefing: () =>
    fetchApi<{
      summary: string;
      alert_count: number;
      critical_count: number;
      logbook_entries: number;
      bottleneck_code?: string | null;
      critical_alerts: { equipment_code: string; level: string; title: string; created_at?: string }[];
      recommended_handover_action: string;
      period_hours: number;
    }>("/monitoring/shift-briefing"),
  getWhatIf: (equipmentCode: string, delayDays: number) =>
    fetchApi<Record<string, unknown>>(
      `/monitoring/what-if?equipment_code=${encodeURIComponent(equipmentCode)}&delay_days=${delayDays}`
    ),
  getContagionRisk: () =>
    fetchApi<{
      edges: { from: string; to: string; reason: string; source_risk: number; propagated_risk: number; severity: string }[];
      highest_threat: Record<string, unknown> | null;
    }>("/monitoring/contagion-risk"),
  getMaintenanceDebt: () =>
    fetchApi<{
      total_debt_inr: number;
      interpretation?: string;
      items: {
        equipment_code: string;
        debt_inr: number;
        health_score: number;
        deferred_days?: number;
        action?: string;
      }[];
    }>("/monitoring/maintenance-debt"),
  getPredictiveCalendar: () =>
    fetchApi<{
      schedule: {
        equipment_code: string;
        equipment_name?: string;
        days_until: number;
        rul_cycles?: number;
        health_score?: number;
        failure_probability?: number;
        estimated_service_date: string;
        urgency: string;
        window_action: string;
      }[];
      counts?: { overdue: number; soon: number; planned: number };
      interpretation?: string;
    }>("/monitoring/predictive-calendar"),
  getOperationalSummary: () => fetchApi<OperationalSummary>("/operational/summary"),
  getDelayLogs: (equipmentCode?: string) =>
    fetchApi<{ items: DelayLog[] }>(
      equipmentCode
        ? `/operational/delay-logs?equipment_code=${encodeURIComponent(equipmentCode)}`
        : "/operational/delay-logs"
    ),
  getFaultMessages: (activeOnly = true, equipmentCode?: string) =>
    fetchApi<{ items: FaultMessage[] }>(
      `/operational/fault-messages?active_only=${activeOnly}${
        equipmentCode ? `&equipment_code=${encodeURIComponent(equipmentCode)}` : ""
      }`
    ),
  getFaultCodes: () => fetchApi<{ items: FaultCode[] }>("/operational/fault-codes"),
  getProcessDefects: (equipmentCode: string) =>
    fetchApi<ProcessDefectsResult>(`/operational/process-defects?equipment_code=${encodeURIComponent(equipmentCode)}`),
  getMaintenancePlan: (equipmentCode: string) =>
    fetchApi<MaintenancePlan>(`/operational/maintenance-plan?equipment_code=${encodeURIComponent(equipmentCode)}`),
  diagnose: (data: {
    equipment_id?: number;
    equipment_code?: string;
    query: string;
    sensor_data?: Record<string, number>;
    fault_description?: string;
    include_rul?: boolean;
    include_spare_parts?: boolean;
  }) =>
    fetchApi<DiagnosisResult>("/diagnosis", {
      method: "POST",
      body: JSON.stringify(data),
    }, CHAT_TIMEOUT_MS),
  submitDiagnosisFeedback: (data: {
    equipment_id?: number;
    diagnosis_summary: string;
    score: number;
    comment?: string;
  }) =>
    fetchApi("/diagnosis/feedback", { method: "POST", body: JSON.stringify(data) }),
  ingestSensor: (data: {
    equipment_id: number;
    temperature?: number;
    vibration?: number;
    pressure?: number;
    motor_current?: number;
    readings?: { sensor_type: string; value: number; unit?: string }[];
  }) =>
    fetchApi<{ sensor_id: number; anomaly_detected: boolean; alert_id?: number }>(
      "/sensors/ingest",
      { method: "POST", body: JSON.stringify(data) }
    ),
};
