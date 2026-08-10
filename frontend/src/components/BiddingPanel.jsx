import React, { useEffect, useState } from "react";

const SUITS = [
  { name: "clubs", symbol: "♣", color: "#1a1a1a" },
  { name: "diamonds", symbol: "♦", color: "#d32f2f" },
  { name: "hearts", symbol: "♥", color: "#d32f2f" },
  { name: "spades", symbol: "♠", color: "#1a1a1a" },
];
const SUIT_ORDER = SUITS.map((suit) => suit.name);

export default function BiddingPanel({ state, send, isMyTurn }) {
  const [bidValue, setBidValue] = useState(4);
  const [suit, setSuit] = useState(null);

  const regularBids = [4, 5, 6, 7].filter((value) => value >= Math.max(4, state.bid));

  useEffect(() => {
    if (state.bid <= 7) setBidValue(Math.max(4, state.bid));
  }, [state.bid]);

  function canBeatCurrent(value) {
    if (!suit) return false;
    return value > state.bid || (value === state.bid && SUIT_ORDER.indexOf(suit) > SUIT_ORDER.indexOf(state.bidSuit));
  }

  function submitBid() {
    if (!canBeatCurrent(bidValue)) return;
    send({ type: "bid", bid: bidValue, suit });
    setSuit(null);
  }

  function callChakri() {
    if (!canBeatCurrent(8)) return;
    send({ type: "bid", bid: 8, suit, chakri: true });
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
            Current bid: <b style={{ color: "var(--gold)" }}>{state.bid === 8 ? "CHAKRI" : state.bid}</b>{state.bid === 8 ? " " : " hands of "}
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
                  {b.bid === 8 ? "CHAKRI " : b.bid}
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
                {regularBids.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <button
              onClick={submitBid}
              disabled={!canBeatCurrent(bidValue) || regularBids.length === 0}
              style={{
                padding: "8px 20px",
                borderRadius: "6px",
                border: "none",
                fontWeight: "bold",
                cursor: canBeatCurrent(bidValue) && regularBids.length ? "pointer" : "not-allowed",
                background: canBeatCurrent(bidValue) && regularBids.length ? "var(--gold)" : "#555",
                color: canBeatCurrent(bidValue) && regularBids.length ? "#333" : "#999",
                opacity: canBeatCurrent(bidValue) && regularBids.length ? 1 : 0.5,
              }}
            >
              Bid {bidValue} {suit && ({ hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" })[suit]}
            </button>
            <button
              onClick={callChakri}
              disabled={!canBeatCurrent(8)}
              title="Declare that your team will win all eight hands"
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                border: "2px solid var(--gold)",
                fontWeight: "bold",
                cursor: canBeatCurrent(8) ? "pointer" : "not-allowed",
                background: canBeatCurrent(8) ? "#6d4aff" : "#444",
                color: "white",
                opacity: canBeatCurrent(8) ? 1 : 0.5,
              }}
            >
              ★ Chakri
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
