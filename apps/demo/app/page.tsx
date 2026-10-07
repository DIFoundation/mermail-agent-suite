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
    isX402?: boolean;
    x402Url?: string;
  };
  status: string;
  quote?: {
    quoteId: string;
    expiresAt: string;
  };
  failureReason?: string;
};

type Payment = {
  executionId: string;
  status: string;
  amount: string;
  currency: string;
  recipient: string;
  purpose: string;
  workflowId: string;
};

type AuditEvent = {
  id: string;
  timestamp: string;
  eventType: string;
  workflowId: string;
  metadata: Record<string, unknown>;
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
  const [payment, setPayment] = useState<Payment | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [executing, setExecuting] = useState(false);
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

  useEffect(() => {
    if (workflow) {
      fetch(`/api/audit/${workflow.request.id}`)
        .then((response) => response.json())
        .then((data) => {
          setAuditEvents(data.events || []);
        })
        .catch(() => setAuditEvents([]));
    } else {
      setAuditEvents([]);
    }
  }, [workflow]);

  async function createCommerceRequest() {
    if (!selected) return;

    setCreating(true);
    setNotice("");

    try {
      const response = await fetch(
        `/api/inbox/${selected.id}/commerce`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
          data.status ??
          "Unable to create commerce request.",
        );
      }

      setWorkflow(data.workflow);
      setNotice(
        "Commerce request created. Human approval required.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to create commerce request.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function saveDestination() {
    if (!workflow) return;

    const input =
      document.getElementById(
        "payment-recipient",
      ) as HTMLInputElement | null;

    const recipient = input?.value.trim();

    if (!recipient) {
      setNotice("Payment recipient is required.");
      return;
    }

    setCreating(true);
    setNotice("");

    try {
      const response = await fetch(
        `/api/workflows/${workflow.request.id}/details`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
          "Unable to save payment details.",
        );
      }

      setWorkflow(data);
      setNotice(
        "Payment destination recorded. Human approval required.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to save payment details.",
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

  async function executeWorkflow() {
    if (!workflow) return;
    setExecuting(true);
    setNotice("Executing approved payment...");

    setPayment({
      executionId: "",
      status: "",
      amount: "",
      currency: "",
      recipient: "",
      purpose: "",
      workflowId: "",
    });

    // Use x402 execution if this is an x402 request
    const endpoint = workflow.request.isX402
      ? `/api/workflows/${workflow.request.id}/execute-x402`
      : `/api/workflows/${workflow.request.id}/execute`;

    const response = await fetch(endpoint, {
      method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
      setNotice(data.error ?? "Execution failed");
      return;
    }

    setExecuting(false);

    console.log("execute complete:", data);

    if (workflow.request.isX402) {
      setNotice(
        data.status === "PROOF_READY"
          ? "x402 payment proof created. Merchant redemption is not yet confirmed."
          : "x402 payment is still pending.",
      );
      setWorkflow(data.workflow);
      setPayment({
        executionId: data.requestId ?? "",
        status: data.status,
        amount: workflow.request.amount,
        currency: workflow.request.currency,
        recipient: workflow.request.recipient,
        purpose: workflow.request.purpose,
        workflowId: workflow.request.id,
      });

      return;
    } else {
      setPayment(data.payment);

      if (data.status === "PENDING") {
        setNotice("Payment pending signature/approval. Polling for settlement...");
        await pollPaymentStatus(workflow.request.id);
      } else {
        setNotice(`Payment settled: ${data.payment.executionId}`);
        setWorkflow(data.workflow);
      }
    }
  }

  async function reconcilePayment(workflowId: string) {
    setNotice("Reconciling PayBox payment...");
    setExecuting(true);

    try {
      const response = await fetch(
        `/api/workflows/${workflowId}/check-payment`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setNotice(
          data.error ?? "Payment reconciliation failed.",
        );
        return;
      }

      setWorkflow(data.workflow);

      if (data.status === "COMPLETED") {
        setNotice("Payment settlement confirmed.");
        return;
      }

      if (data.status === "PENDING") {
        setNotice("PayBox confirms the payment is still pending.");
        return;
      }

      if (data.status === "FAILED") {
        setNotice(
          `PayBox confirmed payment failure: ${data.workflow.failureReason
          }`,
        );
        return;
      }

      if (data.status === "SUBMISSION_UNKNOWN") {
        setNotice(
          "PayBox still cannot establish the submission outcome. Do not retry.",
        );
        return;
      }

      setNotice("Payment reconciliation requires further review.");
    } finally {
      setExecuting(false);
    }
  }

  async function pollPaymentStatus(workflowId: string) {
    const pollInterval = 3000; // 3 seconds
    const maxAttempts = 60; // 3 minutes total
    let attempts = 0;

    const poll = async () => {
      attempts++;
      if (attempts > maxAttempts) {
        setNotice("Payment status check timed out. Please check manually.");
        return;
      }

      const response = await fetch(
        `/api/workflows/${workflowId}/check-payment`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setNotice(data.error ?? "Payment status check failed");
        return;
      }

      if (data.status === "COMPLETED") {
        setNotice(`Payment settled: ${data.workflow.executionId}`);
        setWorkflow(data.workflow);
        setPayment({
          executionId: data.workflow.executionId,
          status: "SETTLED",
          amount: data.workflow.request.amount,
          currency: data.workflow.request.currency,
          recipient: data.workflow.request.recipient,
          purpose: data.workflow.request.purpose,
          workflowId: data.workflow.id,
        });
        return;
      }

      if (data.status === "FAILED") {
        setNotice(`Payment failed: ${data.workflow.failureReason}`);
        setWorkflow(data.workflow);
        return;
      }

      // Still pending, continue polling
      setTimeout(poll, pollInterval);
    };

    poll();
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
                className={`message ${selected?.id === message.id ? "selected" : ""
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

                      {workflow.status === "DETAILS_REQUIRED" && (
                        <div className="approval">
                          <div className="approval-header">
                            <div>
                              <p className="eyebrow">
                                PAYMENT DETAILS REQUIRED
                              </p>

                              <h3>
                                Confirm payment destination
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

                          <p>
                            The email did not provide a trusted payment
                            destination. No recipient has been inferred
                            from the message.
                          </p>

                          <input
                            type="text"
                            placeholder="Enter payment recipient"
                            id="payment-recipient"
                          />

                          <button
                            className="primary"
                            onClick={saveDestination}
                            disabled={creating}
                          >
                            {creating
                              ? "Saving..."
                              : "Confirm Payment Destination"}
                          </button>
                        </div>
                      )}

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
                          {workflow.request.isX402 && (
                            <div className="x402-indicator">
                              📡 x402 request detected
                            </div>
                          )}
                          <div className="approval-actions">
                            <button
                              className="danger"
                              onClick={() => {
                                setWorkflow(null);
                                setNotice(
                                  "Execution Cancelled.",
                                );
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              className="primary-action"
                              onClick={() =>
                                executeWorkflow()
                              }
                            >
                              {executing ? "Executing..." : (workflow.request.isX402
                                ? "Execute x402 Payment"
                                : "Execute Approved Payment")}
                            </button>
                          </div>
                        </div>
                      )}

                      {workflow.status === "EXECUTING" && (
                        <div className="executing">
                          ⏳ Payment execution in progress...
                          {payment?.status === "PENDING" && (
                            <div className="pending-info">
                              <span>Waiting for signature/approval</span>
                              <button
                                className="secondary"
                                onClick={() => pollPaymentStatus(workflow.request.id)}
                              >
                                Check Status
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {workflow.status === "SUBMISSION_UNKNOWN" && (
                        <div className="failed">
                          ⚠️ Payment submission outcome is unknown.
                          <br />
                          Do not retry the payment until the existing PayBox
                          submission has been reconciled.

                          <div className="approval-actions">
                            <button
                              className="secondary"
                              onClick={() =>
                                reconcilePayment(workflow.request.id)
                              }
                            >
                              Reconcile Payment
                            </button>
                          </div>
                        </div>
                      )}

                      {workflow.status === "X402_PENDING" && (
                        <div className="executing">
                          ⏳ x402 payment in progress...
                        </div>
                      )}

                      {workflow.status === "X402_COMPLETED" && (
                        <div className="executing">
                          ⏳ Continuing original request...
                        </div>
                      )}

                      {workflow.status === "COMPLETED" && (
                        <div className="settled">
                          ✅ Payment settled successfully.
                        </div>
                      )}

                      {workflow.status === "FAILED" && (
                        <div className="failed">
                          ❌ Payment failed: {workflow.failureReason}
                        </div>
                      )}

                      {payment?.status === "SETTLED" && (
                        <div className="approved-state">
                          <strong>Payment completed. </strong>
                          <span>
                            Authoritative execution ID:{" "}
                            {payment?.executionId}
                          </span>
                        </div>
                      )}

                      {auditEvents.length > 0 && (
                        <div className="audit-trail">
                          <h3>Audit Trail</h3>
                          {auditEvents.map((event) => (
                            <div key={event.id} className="audit-event">
                              <div className="audit-header">
                                <span className="audit-type">
                                  {event.eventType.replace(/_/g, " ")}
                                </span>
                                <span className="audit-time">
                                  {new Date(event.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              <div className="audit-details">
                                {Object.entries(event.metadata).map(([key, value]) => (
                                  <div key={key} className="audit-detail">
                                    <span>{key}:</span>
                                    <span>{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
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
