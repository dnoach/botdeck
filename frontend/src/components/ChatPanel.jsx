import React, { useState, useEffect, useRef } from "react";
import { apiFetch } from "../hooks/api.js";

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: isUser ? "flex-end" : "flex-start",
      gap: 3,
      animation: "bubbleIn 0.18s ease-out",
    }}>
      <div style={{
        maxWidth: "82%",
        background: isUser ? "var(--purple)" : "var(--surface2)",
        color: isUser ? "#fff" : "var(--text)",
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        padding: "9px 13px",
        fontSize: 13,
        lineHeight: 1.55,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}>
        {msg.content}
      </div>
      {msg.ts && (
        <span style={{ fontSize: 10, color: "var(--text3)" }}>
          {new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 3 }}>
      <div style={{
        background: "var(--surface2)",
        borderRadius: "16px 16px 16px 4px",
        padding: "10px 14px",
        display: "flex", gap: 5, alignItems: "center",
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--text3)",
            animation: `typingDot 1.2s ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

export default function ChatPanel({ agent, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionKey] = useState(() => `botdeck:${agent.id}:${Date.now()}`);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Focus input on open
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg = { role: "user", content: text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await apiFetch(`/api/chat/${agent.id}`, {
        method: "POST",
        body: JSON.stringify({ message: text, sessionKey }),
      });

      if (res?.ok && res.data?.reply) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: res.data.reply,
          ts: Date.now(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "⚠️ Sorry, I couldn't get a response. Please try again.",
          ts: Date.now(),
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "⚠️ Connection error. Check that the gateway is running.",
        ts: Date.now(),
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.25)",
          zIndex: 200,
          animation: "fadeIn 0.2s ease-out",
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 380,
        background: "var(--surface)",
        borderLeft: "0.5px solid var(--border)",
        display: "flex", flexDirection: "column",
        zIndex: 201,
        animation: "slideInRight 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
        boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
      }}>

        {/* Header */}
        <div style={{
          padding: "14px 16px",
          borderBottom: "0.5px solid var(--border)",
          display: "flex", alignItems: "center", gap: 12,
          background: "var(--surface)",
          flexShrink: 0,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "var(--purple-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, overflow: "hidden", flexShrink: 0,
          }}>
            {agent.avatarPath ? (
              <img
                src={`/api/agents/${agent.id}/avatar`}
                alt={agent.identityName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={e => e.target.style.display = "none"}
              />
            ) : agent.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 500, fontSize: 14 }}>{agent.identityName}</p>
            <p style={{ fontSize: 11, color: "var(--text3)" }}>
              {agent.vibe || agent.model}
            </p>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: "var(--text3)", fontSize: 18, padding: "4px 6px" }}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: "auto",
          padding: "16px 14px",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          {messages.length === 0 && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", flex: 1, gap: 10,
              color: "var(--text3)", textAlign: "center", padding: "40px 20px",
            }}>
              <div style={{ fontSize: 40 }}>{agent.emoji}</div>
              <p style={{ fontWeight: 500, color: "var(--text2)" }}>Chat with {agent.identityName}</p>
              <p style={{ fontSize: 12 }}>Send a message to start the conversation</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}
          {sending && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: "12px 14px",
          borderTop: "0.5px solid var(--border)",
          display: "flex", gap: 8, alignItems: "flex-end",
          background: "var(--surface)",
          flexShrink: 0,
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={`Message ${agent.identityName}...`}
            rows={1}
            style={{
              flex: 1, resize: "none", minHeight: 38, maxHeight: 120,
              borderRadius: 12, padding: "8px 12px", fontSize: 13,
              lineHeight: 1.5, overflowY: "auto",
              background: "var(--surface2)",
              border: "0.5px solid var(--border2)",
            }}
            onInput={e => {
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="primary"
            style={{
              width: 38, height: 38, padding: 0,
              borderRadius: 12, justifyContent: "center",
              opacity: !input.trim() || sending ? 0.5 : 1,
              flexShrink: 0,
            }}
          >
            {sending
              ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
              : <i className="ti ti-send" style={{ fontSize: 16 }} aria-hidden="true" />
            }
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes bubbleIn {
          from { transform: scale(0.92) translateY(6px); opacity: 0; }
          to   { transform: scale(1)    translateY(0);   opacity: 1; }
        }
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0);    opacity: 0.4; }
          30%            { transform: translateY(-5px); opacity: 1;   }
        }
      `}</style>
    </>
  );
}
