import React, { useState } from "react";
import Card from "./Card.jsx";
import BiddingPanel from "./BiddingPanel.jsx";

const SUIT_SYMBOLS = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const SUIT_COLORS = {
  hearts: "#d32f2f",
  diamonds: "#d32f2f",
  clubs: "#1a1a1a",
  spades: "#1a1a1a",
};

// Position 6 players around an oval table
const SEAT_POSITIONS = [
  { top: "8%", left: "50%", label: "bottom" },     // seat 0 (you, bottom)
  { top: "25%", left: "85%", label: "right" },     // seat 1
  { top: "50%", left: "90%", label: "right-top" }, // seat 2
  { top: "70%", left: "50%", label: "top" },       // seat 3 (top)
  { top: "50%", left: "10%", label: "left-top" },  // seat 4
  { top: "25%", left: "15%", label: "left" },      // seat 5
];

export default function GameTable({ state, send }) {
  const { phase, players, currentTurn, yourIndex, trumpSuit, trumpCaller, bid, message } = state;
  const me = players[yourIndex];
  const isMyTurn = currentTurn === yourIndex;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: "radial-gradient(ellipse at center, var(--felt-light) 0%, var(--felt) 40%, var(--felt-dark) 90%)",
        overflow: "hidden",
      }}
    >
      {/* Message bar */}
      <div
        style={{
          position: "absolute",
          top: "45px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 50,
          background: "rgba(0,0,0,0.6)",
          padding: "8px 24px",
          borderRadius: "8px",
          textAlign: "center",
          maxWidth: "80%",
          fontSize: "0.95rem",
        }}
      >
        {message}
      </div>

      {/* Trump indicator */}
      {trumpSuit && (
        <div
          style={{
            position: "absolute",
            top: "45px",
            right: "20px",
            zIndex: 50,
            background: "rgba(0,0,0,0.6)",
            padding: "6px 14px",
            borderRadius: "8px",
            fontSize: "1.1rem",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          Trump:
          <span style={{ color: SUIT_COLORS[trumpSuit], fontSize: "1.3rem" }}>
            {SUIT_SYMBOLS[trumpSuit]}
          </span>
        </div>
      )}

      {/* Bid indicator */}
      {bid > 0 && phase !== "playing" && (
        <div
          style={{
            position: "absolute",
            top: "45px",
            left: "20px",
            zIndex: 50,
            background: "rgba(0,0,0,0.6)",
            padding: "6px 14px",
            borderRadius: "8px",
            fontSize: "0.9rem",
          }}
        >
          Bid: {bid} by {players[trumpCaller]?.name}
        </div>
      )}

      {/* Player seats around the table */}
      {players.map((p, i) => {
        // Rotate so yourIndex is always at the bottom (seat 0 position)
        const rotatedIdx = (i - yourIndex + 6) % 6;
        const pos = SEAT_POSITIONS[rotatedIdx];
        const isCurrent = currentTurn === i;
        const isTrumpCaller = trumpCaller === i;

        return (
          <div
            key={p.id || i}
            style={{
              position: "absolute",
              top: pos.top,
              left: pos.left,
              transform: "translate(-50%, -50%)",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            {/* Player avatar */}
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: p.team === 0 ? "var(--team-a)" : "var(--team-b)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                fontSize: "1.2rem",
                border: isCurrent
                  ? "3px solid var(--gold)"
                  : isTrumpCaller
                  ? "3px solid #ff0"
                  : "2px solid rgba(255,255,255,0.3)",
                boxShadow: isCurrent ? "0 0 12px var(--gold)" : "none",
                position: "relative",
              }}
            >
              {p.name[0]?.toUpperCase()}
              {isTrumpCaller && (
                <span
                  style={{
                    position: "absolute",
                    top: "-8px",
                    right: "-4px",
                    fontSize: "0.7rem",
                    background: "var(--gold)",
                    color: "#333",
                    borderRadius: "50%",
                    width: "16px",
                    height: "16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Trump Caller"
                >
                  T
                </span>
              )}
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text)" }}>
              {p.name}
            </span>
            <span style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>
              {p.tricksWon} tricks
            </span>

            {/* Face-down cards for other players */}
            {i !== yourIndex && p.handCount > 0 && (
              <div style={{ display: "flex", gap: "1px", marginTop: "2px" }}>
                {Array.from({ length: Math.min(p.handCount, 8) }).map((_, j) => (
                  <Card key={j} faceDown small />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Center trick area */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 5,
          width: "300px",
          height: "200px",
          borderRadius: "50%",
          background: "rgba(0,0,0,0.15)",
          border: "2px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        {state.currentTrick && state.currentTrick.length > 0 ? (
          <div style={{ display: "flex", gap: "8px" }}>
            {state.currentTrick.map((play, j) => (
              <div
                key={j}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "2px",
                }}
              >
                <span style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}>
                  {players[play.playerIndex]?.name}
                </span>
                <Card card={play.card} small />
              </div>
            ))}
          </div>
        ) : (
          <span style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
            {phase === "playing" ? "Trick area" : ""}
          </span>
        )}
      </div>

      {/* Bidding panel */}
      {phase === "bidding" && (
        <BiddingPanel state={state} send={send} isMyTurn={isMyTurn} />
      )}

      {/* Scoring overlay */}
      {phase === "scoring" && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 100,
            background: "rgba(0,0,0,0.85)",
            padding: "32px 48px",
            borderRadius: "16px",
            textAlign: "center",
            border: "2px solid var(--gold)",
          }}
        >
          <h2 style={{ color: "var(--gold)", marginBottom: "16px" }}>
            Hand Complete!
          </h2>
          <p style={{ marginBottom: "8px" }}>
            Team A: {state.scores[0]} | Team B: {state.scores[1]}
          </p>
          <p style={{ marginBottom: "20px", color: "var(--text-dim)" }}>
            Team A tricks: {state.teamTricks[0]} | Team B tricks: {state.teamTricks[1]}
          </p>
          <button
            onClick={() => send({ type: "next_hand" })}
            style={{
              padding: "12px 32px",
              borderRadius: "8px",
              border: "none",
              fontSize: "1.1rem",
              fontWeight: "bold",
              cursor: "pointer",
              background: "var(--gold)",
              color: "#333",
            }}
          >
            Next Hand
          </button>
        </div>
      )}

      {/* My hand (bottom) */}
      {me && phase === "playing" && (
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
            display: "flex",
            gap: "6px",
            padding: "8px",
          }}
        >
          {me.hand.map((card) => {
            const canPlay = isMyTurn && canPlayCard(card, state);
            return (
              <Card
                key={card.id}
                card={card}
                disabled={!canPlay}
                onClick={() => send({ type: "play_card", cardId: card.id })}
              />
            );
          })}
        </div>
      )}

      {/* My hand during bidding */}
      {me && phase === "bidding" && (
        <div
          style={{
            position: "absolute",
            bottom: "12px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
            display: "flex",
            gap: "6px",
            padding: "8px",
          }}
        >
          {me.hand.map((card) => (
            <Card key={card.id} card={card} disabled />
          ))}
        </div>
      )}
    </div>
  );
}

// Can this card be played? (must follow suit if possible)
function canPlayCard(card, state) {
  if (!state.currentTrick || state.currentTrick.length === 0) return true; // leading
  const ledSuit = state.currentTrick[0].card.suit;
  const myHand = state.players[state.yourIndex].hand;
  const hasLedSuit = myHand.some((c) => c.suit === ledSuit);
  if (hasLedSuit && card.suit !== ledSuit) return false;
  return true;
}
