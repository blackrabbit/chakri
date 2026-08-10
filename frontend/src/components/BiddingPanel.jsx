import React, { useState } from "react";

const SUITS = [
  { name: "hearts", symbol: "♥", color: "#d32f2f" },
  { name: "diamonds", symbol: "♦", color: "#d32f2f" },
  { name: "clubs", symbol: "♣", color: "#1a1a1a" },
  { name: "spades", symbol: "♠", color: "#1a1a1a" },
];

export default function BiddingPanel({ state, send, isMyTurn }) {
  const [bidValue, setBidValue] = useState(5);
  const [suit, setSuit] = useState(null);

  const minBid = Math.max(5, state.bid + 1);
  const maxBid = 8; // TOTAL_TRICKS

  function submitBid() {
    if (!suit) return;
    send({ type: "bid", bid: bidValue, suit });
    setSuit(null);
  }

  function pass() {
    send({ type: "bid", bid: "pass" });
    setSuit(null);
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
        padding: "16px 24px",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
        border: "1px solid var(--gold)",
        maxWidth: "500px",
      }}
    >
      <h3 style={{ color: "var(--gold)", fontSize: "1.1rem" }}>
        Bidding Phase
      </h3>

      {/* Current bid info */}
      <div style={{ fontSize: "0.85rem", color: "var(--text-dim)", textAlign: "center" }}>
        {state.bid > 0 ? (
          <>
            Current bid: <b style={{ color: "var(--gold)" }}>{state.bid}</b> tricks of{" "}
            <span style={{
              color: state.bidSuit === "hearts" || state.bidSuit === "diamonds" ? "#d32f2f" : "#fff",
              fontSize: "1.1rem",
            }}>
              {({ hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" })[state.bidSuit]}
            </span>
            {" "}by <b>{state.players[state.highestBidder]?.name}</b>
          </>
        ) : (
          "No bid yet"
        )}
      </div>

      {/* All bids history */}
      {state.bids && state.bids.length > 0 && (
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          justifyContent: "center",
          fontSize: "0.75rem",
        }}>
          {state.bids.map((b, i) => (
            <span
              key={i}
              style={{
                background: b.bid === "pass" ? "rgba(100,100,100,0.4)" : "rgba(212,175,55,0.2)",
                padding: "2px 8px",
                borderRadius: "4px",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {state.players[b.playerIndex]?.name}:{" "}
              {b.bid === "pass" ? (
                "pass"
              ) : (
                <>
                  {b.bid}
                  <span style={{
                    color: b.suit === "hearts" || b.suit === "diamonds" ? "#d32f2f" : "#fff",
                  }}>
                    {({ hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" })[b.suit]}
                  </span>
                </>
              )}
            </span>
          ))}
        </div>
      )}

      {isMyTurn ? (
        <>
          {/* Suit selector */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem" }}>Trump:</span>
            {SUITS.map((s) => (
              <button
                key={s.name}
                onClick={() => setSuit(s.name)}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "6px",
                  border: suit === s.name ? "2px solid var(--gold)" : "2px solid rgba(255,255,255,0.2)",
                  background: suit === s.name ? "rgba(212,175,55,0.2)" : "var(--card-bg)",
                  cursor: "pointer",
                  fontSize: "1.2rem",
                  color: s.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {s.symbol}
              </button>
            ))}
          </div>

          {/* Bid controls */}
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label style={{ fontSize: "0.85rem" }}>Bid:</label>
              <select
                value={bidValue}
                onChange={(e) => setBidValue(parseInt(e.target.value, 10))}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "white",
                  border: "none",
                  fontSize: "0.9rem",
                }}
              >
                {Array.from({ length: maxBid - minBid + 1 }, (_, i) => minBid + i).map(
                  (n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  )
                )}
              </select>
            </div>
            <button
              onClick={submitBid}
              disabled={!suit}
              style={{
                padding: "8px 20px",
                borderRadius: "6px",
                border: "none",
                fontWeight: "bold",
                cursor: suit ? "pointer" : "not-allowed",
                background: suit ? "var(--gold)" : "#555",
                color: suit ? "#333" : "#999",
                opacity: suit ? 1 : 0.5,
              }}
            >
              Bid {bidValue} {suit && ({ hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" })[suit]}
            </button>
            <button
              onClick={pass}
              style={{
                padding: "8px 20px",
                borderRadius: "6px",
                border: "none",
                fontWeight: "bold",
                cursor: "pointer",
                background: "#666",
                color: "white",
              }}
            >
              Pass
            </button>
          </div>
          {!suit && (
            <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
              Select a trump suit to place your bid
            </span>
          )}
        </>
      ) : (
        <p style={{ fontSize: "0.85rem" }}>Waiting for {state.players[state.currentTurn]?.name}...</p>
      )}
    </div>
  );
}
