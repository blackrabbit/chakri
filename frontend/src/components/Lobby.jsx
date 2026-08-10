import React from "react";

export default function Lobby({ state, send, yourName }) {
  const players = state?.players || [];
  const seats = Array.from({ length: 6 }, (_, i) => players[i] || null);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: "24px",
        background: "radial-gradient(ellipse at center, var(--felt) 0%, var(--felt-dark) 70%)",
      }}
    >
      <h2 style={{ color: "var(--gold)", fontSize: "2rem" }}>
        Waiting Room
      </h2>
      <p style={{ color: "var(--text-dim)" }}>{state?.message || "Connecting..."}</p>

      {/* Seats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "16px",
        }}
      >
        {seats.map((p, i) => (
          <div
            key={i}
            style={{
              width: "140px",
              height: "100px",
              borderRadius: "12px",
              border: `2px dashed ${p ? "transparent" : "rgba(255,255,255,0.2)"}`,
              background: p
                ? `linear-gradient(135deg, ${
                    p.team === 0 ? "rgba(74,144,217,0.3)" : "rgba(224,101,74,0.3)"
                  }, rgba(0,0,0,0.2))`
                : "rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
            }}
          >
            {p ? (
              <>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: p.team === 0 ? "var(--team-a)" : "var(--team-b)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "bold",
                    fontSize: "1.2rem",
                  }}
                >
                  {p.name[0]?.toUpperCase()}
                </div>
                <span style={{ fontSize: "0.9rem" }}>{p.name}</span>
                <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>
                  Team {p.team === 0 ? "A" : "B"}
                </span>
                {!p.connected && (
                  <span style={{ fontSize: "0.65rem", color: "#f87171" }}>
                    disconnected
                  </span>
                )}
              </>
            ) : (
              <span style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
                Empty Seat
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "12px", fontSize: "0.85rem", color: "var(--text-dim)" }}>
        <span style={{ color: "var(--team-a)" }}>● Team A (seats 1, 3, 5)</span>
        <span style={{ color: "var(--team-b)" }}>● Team B (seats 2, 4, 6)</span>
      </div>

      {players.length === 6 && (
        <button
          onClick={() => send({ type: "start" })}
          style={{
            padding: "16px 48px",
            borderRadius: "12px",
            border: "none",
            fontSize: "1.3rem",
            fontWeight: "bold",
            cursor: "pointer",
            background: "var(--gold)",
            color: "#333",
            boxShadow: "0 4px 16px rgba(212,175,55,0.4)",
          }}
        >
          Start Game
        </button>
      )}

      {/* Share link */}
      {players.length > 0 && players.length < 6 && (
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: "4px" }}>
            Share this link to invite players:
          </p>
          <code
            style={{
              background: "rgba(0,0,0,0.4)",
              padding: "6px 12px",
              borderRadius: "6px",
              color: "var(--gold)",
              cursor: "pointer",
            }}
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
            }}
          >
            {window.location.href}
          </code>
        </div>
      )}
    </div>
  );
}
