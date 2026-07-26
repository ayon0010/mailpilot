// app/inbox/page.tsx
"use client";
import { useEffect, useState } from "react";

export default function InboxPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [label, setLabel] = useState("INBOX");

  useEffect(() => {
    fetch(`/api/inbox?label=${label}`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages));
  }, [label]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Unified Inbox</h1>
      <div style={{ marginBottom: 12 }}>
        {["INBOX", "SENT", "SPAM"].map((l) => (
          <button
            key={l}
            onClick={() => setLabel(l)}
            style={{
              marginRight: 8,
              fontWeight: label === l ? "bold" : "normal",
            }}
          >
            {l}
          </button>
        ))}
      </div>
      {messages.map((m) => (
        <div key={m.id} style={{ padding: 12, borderBottom: "1px solid #eee" }}>
          <div style={{ fontSize: 12, color: "#666" }}>{m.account?.email}</div>
          <div>
            <strong>{m.fromEmail}</strong> → {m.toEmail}
          </div>
          <div>{m.subject}</div>
          <div style={{ color: "#888", fontSize: 13 }}>{m.snippet}</div>
        </div>
      ))}
    </div>
  );
}
