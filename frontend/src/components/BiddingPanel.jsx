import React, { useState } from "react";

export default function BiddingPanel({ state, send, isMyTurn }) {
  const [bidValue, setBidValue] = useState(5);

  const minBid = Math.max(5, state.bid + 1);
  const maxBid = 8; // TOTAL_TRICKS

  return (
    <div
      style={{
        position: "absolute",
        bottom: "120px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 50,
        background: "rgba(0,0,0,0.8)",
        padding: "16px 24px",
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
        border: "1px solid var(--gold)",
      }}
    >
      <h3 style={{ color: "var(--gold)", fontSize: "1.1rem" }}>
        Bidding Phase
      </h3>
      <p style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
        Current bid: {state.bid} by{" "}
        {state.highestBidder >= 0 ? state.players[state.highestBidder]?.name : "—"}
      </p>

      {isMyTurn ? (
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
            onClick={() => send({ type: "bid", bid: bidValue })}
            style={{
              padding: "8px 20px",
              borderRadius: "6px",
              border: "none",
              fontWeight: "bold",
              cursor: "pointer",
              background: "var(--gold)",
              color: "#333",
            }}
          >
            Bid {bidValue}
          </button>
          <button
            onClick={() => send({ type: "bid", bid: "pass" })}
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
      ) : (
        <p style={{ fontSize: "0.85rem" }}>Waiting for {state.players[state.currentTurn]?.name}...</p>
      )}
    </div>
  );
}
