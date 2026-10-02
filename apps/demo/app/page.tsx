"use client";

import { useEffect, useState } from "react";

type Decision = "clear" | "review" | "block";

type Message = {
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
    requiresHumanApproval: boolean;
  };
};

type Workflow = {
  request: {
    id: string;
    service: string;
    recipient: string;
    amount: string;
    currency: string;
    purpose: string;
    sourceMessageId: string;
    userApproved: boolean;
  };
  status: string;
  quote?: {
    quoteId: string;
    expiresAt: string;
  };
};

function Badge({ decision }: { decision: Decision }) {
  return (
    <span className={`badge badge-${decision}`}>
      {decision.toUpperCase()}
    </span>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/inbox")
      .then((response) => response.json())
      .then((data) => {
        setMessages(data.messages);
        setSelected(data.messages[0] ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function createCommerceRequest() {
    if (!selected) return;

    setCreating(true);
    setNotice("");

    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceMessageId: selected.id,
          service: "External agent service",
          recipient: "service.example",
          amount: "10.00",
          currency: "USDC",
          purpose: selected.subject,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setWorkflow(data);
      setNotice("Commerce request created. Human approval required.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to create request.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function approve() {
    if (!workflow) return;

    setApproving(true);
    setNotice("");

    try {
      const response = await fetch(
        `/api/workflows/${workflow.request.id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient: workflow.request.recipient,
            amount: workflow.request.amount,
            currency: workflow.request.currency,
            purpose: workflow.request.purpose,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      setWorkflow(data);
      setNotice(
        "Approved. No payment has been executed.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Approval failed.",
      );
    } finally {
      setApproving(false);
    }
  }

  const counts = {
    clear: messages.filter(
      (m) => m.security.decision === "clear",
    ).length,
    review: messages.filter(
      (m) => m.security.decision === "review",
    ).length,
    block: messages.filter(
      (m) => m.security.decision === "block",
    ).length,
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

      {notice && <div className="notice">{notice}</div>}

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
                onClick={() => {
                  setSelected(message);
                  setWorkflow(null);
                  setNotice("");
                }}
              >
                <div className="message-top">
                  <strong>
                    {message.from.name || message.from.email}
                  </strong>

                  <Badge
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
                  <p className="eyebrow">
                    SECURITY ANALYSIS
                  </p>
                  <h2>{selected.subject}</h2>
                  <p className="sender">
                    From{" "}
                    {selected.from.name ||
                      selected.from.email}
                  </p>
                </div>

                <Badge
                  decision={selected.security.decision}
                />
              </div>

              <div className="risk">
                <div>
                  <span>Risk score</span>
                  <strong>
                    {selected.security.riskScore}/100
                  </strong>
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
                    <div
                      className="signal"
                      key={signal.code}
                    >
                      <div>
                        <strong>{signal.label}</strong>
                        <span>{signal.level}</span>
                      </div>
                      <p>{signal.evidence}</p>
                    </div>
                  ))
                )}
              </div>

              {selected.security.decision === "clear" && (
                <div className="commerce">
                  {!workflow ? (
                    <>
                      <div>
                        <h3>
                          Commerce Bridge
                        </h3>
                        <p>
                          This message is cleared for
                          consideration. Creating a
                          commerce request does not
                          authorize payment.
                        </p>
                      </div>

                      <button
                        className="primary"
                        onClick={createCommerceRequest}
                        disabled={creating}
                      >
                        {creating
                          ? "Creating..."
                          : "Create Commerce Request"}
                      </button>
                    </>
                  ) : (
                    <div className="approval">
                      <div className="approval-header">
                        <div>
                          <p className="eyebrow">
                            HUMAN AUTHORIZATION
                          </p>
                          <h3>
                            {workflow.status}
                          </h3>
                        </div>

                        <span className="approval-lock">
                          🔒
                        </span>
                      </div>

                      <div className="approval-grid">
                        <div>
                          <span>Service</span>
                          <strong>
                            {workflow.request.service}
                          </strong>
                        </div>

                        <div>
                          <span>Recipient</span>
                          <strong>
                            {workflow.request.recipient}
                          </strong>
                        </div>

                        <div>
                          <span>Amount</span>
                          <strong>
                            {workflow.request.amount}{" "}
                            {workflow.request.currency}
                          </strong>
                        </div>

                        <div>
                          <span>Purpose</span>
                          <strong>
                            {workflow.request.purpose}
                          </strong>
                        </div>
                      </div>

                      {workflow.status ===
                        "APPROVAL_REQUIRED" && (
                        <div className="approval-actions">
                          <button
                            className="danger"
                            onClick={() => {
                              setWorkflow(null);
                              setNotice(
                                "Commerce request rejected.",
                              );
                            }}
                          >
                            Reject
                          </button>

                          <button
                            className="primary"
                            onClick={approve}
                            disabled={approving}
                          >
                            {approving
                              ? "Approving..."
                              : "Approve Request"}
                          </button>
                        </div>
                      )}

                      {workflow.status === "APPROVED" && (
                        <div className="approved">
                          ✓ Human approval recorded.
                          <br />
                          <small>
                            Payment execution remains
                            disabled in this milestone.
                          </small>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </article>
      </section>
    </main>
  );
}
