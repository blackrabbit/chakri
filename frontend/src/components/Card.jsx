import React from "react";

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

export default function Card({ card, faceDown, onClick, disabled, small }) {
  if (faceDown || !card) {
    return (
      <div
        style={{
          width: small ? "40px" : "64px",
          height: small ? "56px" : "90px",
          borderRadius: small ? "4px" : "8px",
          background: "repeating-linear-gradient(45deg, #1a3a5c, #1a3a5c 4px, #2a4a6c 4px, #2a4a6c 8px)",
          border: "2px solid #fff",
          boxShadow: "0 2px 6px var(--card-shadow)",
          display: "inline-block",
        }}
      />
    );
  }

  const symbol = SUIT_SYMBOLS[card.suit] || "?";
  const color = SUIT_COLORS[card.suit] || "#333";
  const w = small ? "40px" : "64px";
  const h = small ? "56px" : "90px";
  const fs = small ? "0.7rem" : "1.2rem";
  const bigFs = small ? "1rem" : "1.8rem";

  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        width: w,
        height: h,
        borderRadius: small ? "4px" : "8px",
        background: "var(--card-bg)",
        border: "2px solid #ccc",
        boxShadow: disabled ? "none" : "0 2px 8px var(--card-shadow)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "transform 0.15s, box-shadow 0.15s",
        position: "relative",
        userSelect: "none",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.transform = "translateY(-8px)";
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div
        style={{
          position: "absolute",
          top: small ? "2px" : "4px",
          left: small ? "3px" : "5px",
          fontSize: fs,
          fontWeight: "bold",
          color,
        }}
      >
        {card.rank}
      </div>
      <div style={{ fontSize: bigFs, color }}>{symbol}</div>
      <div
        style={{
          position: "absolute",
          bottom: small ? "2px" : "4px",
          right: small ? "3px" : "5px",
          fontSize: fs,
          fontWeight: "bold",
          color,
          transform: "rotate(180deg)",
        }}
      >
        {card.rank}
      </div>
    </div>
  );
}
