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

interface DetectionRule {
  code: string;
  pattern: RegExp;
  level: RiskLevel;
  evidence: string;
}

const DETECTION_RULES: DetectionRule[] = [
  {
    code: "prompt-injection",
    pattern:
      /ignore\s+(all\s+)?previous|ignore\s+(the\s+)?system|ignore\s+(the\s+)?developer|disregard\s+(all\s+)?previous|system\s+prompt|developer\s+message|override\s+(your|the)\s+(instructions|rules)/i,
    level: "critical",
    evidence:
      "Message attempts to override or manipulate the agent's instructions.",
  },
  {
    code: "approval-bypass",
    pattern:
      /skip\s+(human|manual)\s+approval|bypass\s+(human|manual)\s+approval|no\s+(need|requirement)\s+for\s+(human|manual)\s+approval|do\s+not\s+ask\s+(the\s+)?user|don't\s+ask\s+(the\s+)?user|execute\s+without\s+approval/i,
    level: "critical",
    evidence:
      "Message attempts to bypass the required human authorization boundary.",
  },
  {
    code: "secret-request",
    pattern:
      /seed\s*phrase|recovery\s+phrase|private\s+key|secret\s+key|api[\s_-]?key|access\s+token|auth(?:entication)?\s+token|password|passcode|verification\s+code|2fa\s+code|otp/i,
    level: "critical",
    evidence:
      "Message requests a credential, authentication secret, or wallet secret.",
  },
  {
    code: "payment-pressure",
    pattern:
      /send\s+(the\s+)?payment|pay\s+now|urgent\s+payment|transfer\s+funds|send\s+funds|wire\s+money|make\s+(the\s+)?payment|pay\s+this\s+(invoice|address)|deposit\s+(funds|money)/i,
    level: "high",
    evidence:
      "Message requests or pressures an external financial action.",
  },
  {
    code: "payment-address-change",
    pattern:
      /(new|updated|different|alternative)\s+(wallet|payment|deposit)\s+address|send\s+to\s+(this|the\s+new)\s+address|change\s+(the\s+)?payment\s+address/i,
    level: "high",
    evidence:
      "Message attempts to introduce or change a payment destination.",
  },
  {
    code: "suspicious-link",
    pattern: /https?:\/\/[^\s]+/i,
    level: "medium",
    evidence:
      "Message contains an external link that requires independent verification.",
  },
  {
    code: "dangerous-attachment",
    pattern:
      /\.(?:exe|scr|bat|cmd|com|msi|dll|jar|ps1)\b|\.zip\b|macro[-\s]?enabled|enable\s+macros|run\s+(this|the)\s+(file|attachment)/i,
    level: "high",
    evidence:
      "Message references a potentially dangerous attachment or execution path.",
  },
  {
    code: "external-side-effect",
    pattern:
      /\b(send|forward|delete|remove|invite|add|pay|purchase|buy|sign|approve|publish|post|transfer|withdraw|change|update|disable|enable)\b.{0,80}\b(account|email|message|file|funds|wallet|user|settings|permission|access|payment)/i,
    level: "high",
    evidence:
      "Message requests an external side effect that requires authorization.",
  },
  {
    code: "destructive-action",
    pattern:
      /\b(delete|destroy|erase|remove|revoke|disable|terminate|close)\b.{0,80}\b(account|data|wallet|access|permission|record|service)/i,
    level: "high",
    evidence:
      "Message requests a potentially destructive account or data action.",
  },
  {
    code: "identity-impersonation",
    pattern:
      /\b(admin|administrator|support|security|finance|ceo|cfo|owner)\b.{0,60}\b(send|pay|transfer|share|provide|verify|confirm)/i,
    level: "medium",
    evidence:
      "Message uses an authority or support identity to request a sensitive action.",
  },
  {
    code: "urgency-pressure",
    pattern:
      /urgent|immediately|right\s+now|within\s+\d+\s+(minute|minutes|hour|hours)|act\s+now|last\s+warning|final\s+notice|expires?\s+(today|soon)/i,
    level: "medium",
    evidence:
      "Message uses urgency or pressure that may reduce normal verification.",
  },
];

const WEIGHTS: Record<RiskLevel, number> = {
  low: 5,
  medium: 20,
  high: 45,
  critical: 80,
};

function highestRisk(signals: Signal[]): RiskLevel {
  if (signals.some((signal) => signal.level === "critical")) return "critical";
  if (signals.some((signal) => signal.level === "high")) return "high";
  if (signals.some((signal) => signal.level === "medium")) return "medium";
  return "low";
}

function calculateDecision(signals: Signal[], riskScore: number): Decision {
  if (signals.some((signal) => signal.level === "critical")) return "block";
  if (signals.some((signal) => signal.level === "high")) return "review";
  if (riskScore >= 45) return "review";
  return "clear";
}

export function analyzeMessage(input: {
  subject?: string;
  body: string;
}): SentinelResult {
  const subject = input.subject ?? "";
  const body = input.body ?? "";
  const haystack = `${subject}\n${body}`.trim();

  if (!haystack) {
    return {
      decision: "review",
      riskScore: 20,
      signals: [
        {
          code: "empty-message",
          label: "empty message",
          level: "medium",
          evidence: "Message contains no usable subject or body content.",
        },
      ],
      reasons: ["The message cannot be safely evaluated without content."],
      requiresHumanApproval: true,
    };
  }

  const signals: Signal[] = [];

  for (const rule of DETECTION_RULES) {
    if (rule.pattern.test(haystack)) {
      signals.push({
        code: rule.code,
        label: rule.code.replaceAll("-", " "),
        level: rule.level,
        evidence: rule.evidence,
      });
    }
  }

  const riskScore = Math.min(
    100,
    signals.reduce((sum, signal) => sum + WEIGHTS[signal.level], 0),
  );

  const decision = calculateDecision(signals, riskScore);

  /*
   * CLEAR is never equivalent to "authorized".
   * Any action that can cause an external effect still requires approval.
   */
  const requiresHumanApproval =
    decision !== "clear" ||
    signals.some((signal) =>
      [
        "payment-pressure",
        "payment-address-change",
        "external-side-effect",
        "destructive-action",
      ].includes(signal.code),
    ) ||
    /\b(send|forward|delete|invite|pay|purchase|sign|approve|publish|post|transfer|withdraw|change|update|revoke)\b/i.test(
      haystack,
    );

  return {
    decision,
    riskScore,
    signals,
    reasons: signals.map((signal) => signal.evidence),
    requiresHumanApproval,
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

export function canExecuteCommerce(request: CommerceRequest): {
  allowed: boolean;
  reason: string;
} {
  if (request.sentinel.decision !== "clear") {
    return {
      allowed: false,
      reason: "Sentinel clearance is required before commerce execution.",
    };
  }

  if (!request.userApproved) {
    return {
      allowed: false,
      reason:
        "Explicit human approval is required before an external payment or service execution.",
    };
  }

  if (!request.recipient || !request.amount || !request.currency) {
    return {
      allowed: false,
      reason: "Recipient, amount and currency must be explicit.",
    };
  }

  if (!request.service || !request.purpose) {
    return {
      allowed: false,
      reason: "Service and purpose must be explicit.",
    };
  }

  return {
    allowed: true,
    reason: "Cleared for the next Mermail commerce workflow step.",
  };
}

export type {
  MermailMessage,
  InboxProvider,
} from "./mermail/types";

export {
  normalizeMermailMessage,
  normalizeMermailMessages,
} from "./mermail/normalize";

export {
  inspectInbox,
  inspectInboxMessage,
} from "./mermail/inbox";

export type {
  CommerceStatus,
  CommerceRequest as CommerceWorkflowRequest,
  CommerceQuote,
  CommerceWorkflow,
  TransitionResult,
} from "./commerce/workflow";

export {
  createCommerceWorkflow,
  attachQuote,
  approveCommerce,
  beginExecution,
  completeExecution,
  failExecution,
  beginX402Execution,
  completeX402Execution,
  continueOriginalRequest,
  markSubmissionUnknown,
} from "./commerce/workflow";

export * from "./payment/types";
export * from "./payment/executor";

export {
  extractCommerceRequest,
} from "./commerce/extract";

export type {
  CommerceExtractionStatus,
  ExtractedCommerceRequest,
} from "./commerce/extract";

export { decimalToAtomicUnits } from "./payment/units";

export type {
  AuditEventType,
  AuditEvent,
  AuditRecord,
} from "./audit/types";

export { auditStore, setAuditPersistence } from "./audit/store";
