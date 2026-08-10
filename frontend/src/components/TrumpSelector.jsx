import React from "react";

const SUITS = [
  { name: "hearts", symbol: "♥", color: "#d32f2f" },
  { name: "diamonds", symbol: "♦", color: "#d32f2f" },
  { name: "clubs", symbol: "♣", color: "#1a1a1a" },
  { name: "spades", symbol: "♠", color: "#1a1a1a" },
];

export default function TrumpSelector({ state, send, isMyTurn }) {
  if (!isMyTurn) {
    return (
      <div
        style={{
          position: "absolute",
          bottom: "120px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 50,
          background: "rgba(0,0,0,0.8)",
          padding: "16px 32px",
          borderRadius: "12px",
          border: "1px solid var(--gold)",
        }}
      >
        <p style={{ fontSize: "0.9rem" }}>
          Waiting for {state.players[state.trumpCaller]?.name} to choose trump...
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: "120px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        background: "rgba(0,0,0,0.85)",
        padding: "20px 32px",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "16px",
        border: "1px solid var(--gold)",
      }}
    >
      <h3 style={{ color: "var(--gold)", fontSize: "1.2rem" }}>
        Choose Trump Suit
      </h3>
      <p style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
        You won the bid with {state.bid} hands.
      </p>
      <div style={{ display: "flex", gap: "16px" }}>
        {SUITS.map((s) => (
          <button
            key={s.name}
            onClick={() => send({ type: "choose_trump", suit: s.name })}
            style={{
              width: "64px",
              height: "80px",
              borderRadius: "12px",
              border: "2px solid rgba(255,255,255,0.2)",
              background: "var(--card-bg)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2.5rem",
              color: s.color,
              transition: "transform 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.1)";
              e.currentTarget.style.borderColor = "var(--gold)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
            }}
          >
            {s.symbol}
          </button>
        ))}
      </div>
    </div>
  );
}
