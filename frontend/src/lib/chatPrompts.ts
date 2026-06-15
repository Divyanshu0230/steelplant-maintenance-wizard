export type QuickPrompt = { prompt: string; requiresEquipment?: boolean; assetSpecific?: boolean };

const PLANT_NAV_PROMPTS: QuickPrompt[] = [
  { prompt: "Where is Live Monitoring?" },
  { prompt: "Show me the Priority queue" },
  { prompt: "Summarize fleet health" },
];

function assetCategory(code: string, equipmentType?: string): string {
  const hay = `${code} ${equipmentType ?? ""}`.toLowerCase();
  if (hay.includes("blower")) return "blower";
  if (hay.includes("pump")) return "pump";
  if (hay.includes("motor")) return "motor";
  if (hay.includes("crane")) return "crane";
  if (hay.includes("conveyor")) return "conveyor";
  if (hay.includes("furnace")) return "furnace";
  return "general";
}

const ASSET_PROMPTS: Record<string, (code: string) => string[]> = {
  blower: (code) => [
    `Summary of issues for ${code}`,
    `Why is ${code} vibration critical?`,
    `Is ${code} safe to keep running?`,
    `Root cause for ${code} fault alarm`,
    `Which spare parts does ${code} need?`,
  ],
  pump: (code) => [
    `Summary of issues for ${code}`,
    `Is ${code} safe to keep running?`,
    `What should I do next for ${code}?`,
    `Cooling system risk for ${code}`,
    `Spare parts needed for ${code}`,
  ],
  motor: (code) => [
    `Summary of issues for ${code}`,
    `Motor temperature status for ${code}`,
    `Is ${code} safe to keep running?`,
    `Root cause for ${code} overload`,
    `RUL estimate for ${code}`,
  ],
  crane: (code) => [
    `Summary of issues for ${code}`,
    `Safety check for ${code}`,
    `What maintenance does ${code} need?`,
    `Recent faults on ${code}`,
  ],
  conveyor: (code) => [
    `Summary of issues for ${code}`,
    `Belt wear status for ${code}`,
    `Is ${code} safe to keep running?`,
    `Next maintenance for ${code}`,
  ],
  furnace: (code) => [
    `Summary of issues for ${code}`,
    `Thermal risk for ${code}`,
    `Is ${code} safe to keep running?`,
    `Emergency actions for ${code}`,
  ],
  general: (code) => [
    `Summary of issues for ${code}`,
    `Is ${code} safe to keep running?`,
    `What should I do next for ${code}?`,
    `Root cause for recent fault on ${code}`,
    `Spare parts for ${code}`,
  ],
};

export function getQuickPrompts(
  equipmentCode?: string,
  equipmentType?: string,
  riskLevel?: string
): QuickPrompt[] {
  if (!equipmentCode) {
    return PLANT_NAV_PROMPTS;
  }

  const cat = assetCategory(equipmentCode, equipmentType);
  const prompts = ASSET_PROMPTS[cat](equipmentCode).map((prompt) => ({
    prompt,
    requiresEquipment: true,
    assetSpecific: true,
  }));

  if (riskLevel === "critical" || riskLevel === "high") {
    prompts.unshift({
      prompt: `Emergency actions for ${equipmentCode}`,
      requiresEquipment: true,
      assetSpecific: true,
    });
  }

  return [
    ...prompts,
    { prompt: "Show me the Priority queue" },
    { prompt: "Where is Live Monitoring?" },
  ];
}

export const CHAT_WELCOME_LINES = {
  title: "AI Agentic Assistant",
  subtitle: "Ask about the plant, navigate the app, or discuss the selected asset.",
  howTo: "1) Pick a focus asset · 2) Tap a suggestion or type your question",
};
