export type RiskLevel = "low" | "medium" | "high" | "critical";
export type Decision = "clear" | "review" | "block";

export interface Signal {
  code: string;
  label: string;
  level: RiskLevel;
  evidence: string;
}

export interface SentinelResult {
  decision: Decision;
  riskScore: number;
  signals: Signal[];
  reasons: string[];
  requiresHumanApproval: boolean;
}

const suspiciousPatterns: Array<[string, RegExp, RiskLevel, string]> = [
  ["prompt-injection", /ignore\s+(all\s+)?previous|system\s+prompt|developer\s+message/i, "high", "Message attempts to override agent instructions."],
  ["secret-request", /seed phrase|private key|secret key|password|api key|verification code/i, "critical", "Message requests a credential or secret."],
  ["payment-pressure", /send\s+(the\s+)?payment|pay\s+now|urgent\s+payment|transfer\s+funds/i, "high", "Message requests or pressures an external payment."],
  ["suspicious-link", /https?:\/\/[^\s]+/i, "medium", "Message contains an external link that must be treated as untrusted."],
  ["attachment-risk", /\.zip\b|\.exe\b|\.scr\b|macro-enabled|enable\s+macros/i, "high", "Message references a potentially dangerous attachment or execution path."]
];

const weight: Record<RiskLevel, number> = { low: 5, medium: 20, high: 45, critical: 80 };

export function analyzeMessage(input: { subject?: string; body: string }): SentinelResult {
  const haystack = `${input.subject ?? ""}\n${input.body}`;
  const signals: Signal[] = [];
  for (const [code, pattern, level, evidence] of suspiciousPatterns) {
    if (pattern.test(haystack)) signals.push({ code, label: code.replaceAll("-", " "), level, evidence });
  }
  const riskScore = Math.min(100, signals.reduce((sum, s) => sum + weight[s.level], 0));
  const decision: Decision = signals.some(s => s.level === "critical")
    ? "block"
    : riskScore >= 45
      ? "review"
      : "clear";
  return {
    decision,
    riskScore,
    signals,
    reasons: signals.map(s => s.evidence),
    requiresHumanApproval: decision !== "clear" || /payment|send|reply|forward/i.test(haystack)
  };
}

export interface CommerceRequest {
  service: string;
  amount: string;
  currency: string;
  recipient: string;
  purpose: string;
  sentinel: SentinelResult;
  userApproved: boolean;
}

export function canExecuteCommerce(request: CommerceRequest): { allowed: boolean; reason: string } {
  if (request.sentinel.decision !== "clear") return { allowed: false, reason: "Sentinel clearance is required before commerce execution." };
  if (!request.userApproved) return { allowed: false, reason: "Explicit human approval is required before an external payment or service execution." };
  if (!request.recipient || !request.amount || !request.currency) return { allowed: false, reason: "Recipient, amount and currency must be explicit." };
  return { allowed: true, reason: "Cleared for the next Mermail commerce workflow step." };
}
