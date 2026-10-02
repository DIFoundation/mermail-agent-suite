"use client";

import { useEffect, useState } from "react";

type Decision = "clear" | "review" | "block";

interface Message {
  id: string;
  from: {
    name?: string;
    email: string;
  };
  subject: string;
  body: string;
  receivedAt: string;
  security: {
    decision: Decision;
    riskScore: number;
    signals: Array<{
      code: string;
      label: string;
      level: string;
      evidence: string;
    }>;
    reasons: string[];
    requiresHumanApproval: boolean;
  };
}

const decisionLabel: Record<Decision, string> = {
  clear: "CLEAR",
  review: "REVIEW",
  block: "BLOCK",
};

function DecisionBadge({ decision }: { decision: Decision }) {
  return (
    <span className={`badge badge-${decision}`}>
      {decisionLabel[decision]}
    </span>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/inbox")
      .then((response) => response.json())
      .then((data) => {
        setMessages(data.messages);
        setSelected(data.messages[0] ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const counts = {
    clear: messages.filter((m) => m.security.decision === "clear").length,
    review: messages.filter((m) => m.security.decision === "review").length,
    block: messages.filter((m) => m.security.decision === "block").length,
  };

  return (
    <main className="shell">
      <header className="header">
        <div>
          <p className="eyebrow">MERMAIL AGENT SUITE</p>
          <h1>Security Console</h1>
          <p className="subtitle">
            Email is data, not authority.
          </p>
        </div>

        <div className="status">
          <span className="status-dot" />
          Sentinel online
        </div>
      </header>

      <section className="stats">
        <div className="stat">
          <span>Messages</span>
          <strong>{messages.length}</strong>
        </div>

        <div className="stat">
          <span>Clear</span>
          <strong>{counts.clear}</strong>
        </div>

        <div className="stat">
          <span>Review</span>
          <strong>{counts.review}</strong>
        </div>

        <div className="stat">
          <span>Blocked</span>
          <strong>{counts.block}</strong>
        </div>
      </section>

      <section className="workspace">
        <aside className="inbox">
          <div className="section-title">
            <span>INBOX</span>
            <span>{messages.length}</span>
          </div>

          {loading ? (
            <div className="empty">Loading inbox...</div>
          ) : (
            messages.map((message) => (
              <button
                key={message.id}
                className={`message ${
                  selected?.id === message.id ? "selected" : ""
                }`}
                onClick={() => setSelected(message)}
              >
                <div className="message-top">
                  <strong>
                    {message.from.name || message.from.email}
                  </strong>
                  <DecisionBadge
                    decision={message.security.decision}
                  />
                </div>

                <span className="message-subject">
                  {message.subject}
                </span>

                <span className="message-preview">
                  {message.body}
                </span>
              </button>
            ))
          )}
        </aside>

        <article className="detail">
          {!selected ? (
            <div className="empty">Select a message.</div>
          ) : (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">SECURITY ANALYSIS</p>
                  <h2>{selected.subject}</h2>
                  <p className="sender">
                    From {selected.from.name || selected.from.email}
                    {" · "}
                    {new Date(selected.receivedAt).toLocaleString()}
                  </p>
                </div>

                <DecisionBadge
                  decision={selected.security.decision}
                />
              </div>

              <div className="risk">
                <div>
                  <span>Risk score</span>
                  <strong>{selected.security.riskScore}/100</strong>
                </div>

                <div className="risk-bar">
                  <div
                    style={{
                      width: `${selected.security.riskScore}%`,
                    }}
                  />
                </div>
              </div>

              <div className="body">
                <h3>Message</h3>
                <p>{selected.body}</p>
              </div>

              <div className="analysis">
                <h3>Detected signals</h3>

                {selected.security.signals.length === 0 ? (
                  <p className="safe">
                    No security signals detected.
                  </p>
                ) : (
                  selected.security.signals.map((signal) => (
                    <div className="signal" key={signal.code}>
                      <div>
                        <strong>{signal.label}</strong>
                        <span>{signal.level}</span>
                      </div>
                      <p>{signal.evidence}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="authorization">
                <span>
                  Human approval required
                </span>
                <strong>
                  {selected.security.requiresHumanApproval
                    ? "YES"
                    : "NO"}
                </strong>
              </div>
            </>
          )}
        </article>
      </section>
    </main>
  );
}
