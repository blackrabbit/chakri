import React, { useState, useEffect, useRef, useCallback } from "react";
import Lobby from "./components/Lobby.jsx";
import GameTable from "./components/GameTable.jsx";

// ---------------------------------------------------------------------------
// WebSocket game client hook
// ---------------------------------------------------------------------------
function useGameSocket(roomId, playerName) {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const playerIdRef = useRef(localStorage.getItem("chakri-pid") || crypto.randomUUID());
  localStorage.setItem("chakri-pid", playerIdRef.current);

  useEffect(() => {
    if (!roomId) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${window.location.host}/api/room/${roomId}?name=${encodeURIComponent(playerName)}&pid=${playerIdRef.current}`;

    let ws;
    let reconnectTimer;

    function connect() {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        reconnectTimer = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "state") {
          setState(msg.state);
        } else if (msg.type === "error") {
          console.error("Game error:", msg.message);
          // brief flash
          setErrorMsg(msg.message);
          setTimeout(() => setErrorMsg(null), 3000);
        }
      };
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [roomId, playerName]);

  const [errorMsg, setErrorMsg] = useState(null);

  const send = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { state, connected, send, error: errorMsg };
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
export default function App() {
  const [screen, setScreen] = useState("home"); // home | game
  const [roomId, setRoomId] = useState("");
  const [playerName, setPlayerName] = useState(
    localStorage.getItem("chakri-name") || ""
  );

  const { state, connected, send, error } = useGameSocket(
    screen === "game" ? roomId : null,
    playerName
  );

  function createRoom() {
    if (!playerName.trim()) return;
    localStorage.setItem("chakri-name", playerName);
    const id = crypto.randomUUID().slice(0, 8);
    setRoomId(id);
    setScreen("game");
  }

  function joinRoom() {
    if (!playerName.trim() || !roomId.trim()) return;
    localStorage.setItem("chakri-name", playerName);
    setScreen("game");
  }

  if (screen === "home") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: "20px",
          background: "radial-gradient(ellipse at center, var(--felt) 0%, var(--felt-dark) 70%)",
        }}
      >
        <h1
          style={{
            fontSize: "3.5rem",
            color: "var(--gold)",
            textShadow: "2px 2px 8px rgba(0,0,0,0.5)",
            marginBottom: "10px",
          }}
        >
          ♠ Chakri ♥
        </h1>
        <p style={{ color: "var(--text-dim)", fontSize: "1.1rem" }}>
          6-Player Court Piece
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            width: "320px",
          }}
        >
          <input
            type="text"
            placeholder="Your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={20}
            style={{
              padding: "12px 16px",
              borderRadius: "8px",
              border: "none",
              fontSize: "1rem",
              background: "rgba(255,255,255,0.95)",
            }}
          />
          <button
            onClick={createRoom}
            style={{
              padding: "14px",
              borderRadius: "8px",
              border: "none",
              fontSize: "1.1rem",
              fontWeight: "bold",
              cursor: "pointer",
              background: "var(--gold)",
              color: "#333",
            }}
          >
            Create New Room
          </button>
          <div
            style={{
              display: "flex",
              gap: "8px",
            }}
          >
            <input
              type="text"
              placeholder="Room code"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              maxLength={8}
              style={{
                flex: 1,
                padding: "12px 16px",
                borderRadius: "8px",
                border: "none",
                fontSize: "1rem",
                background: "rgba(255,255,255,0.95)",
              }}
            />
            <button
              onClick={joinRoom}
              style={{
                padding: "12px 20px",
                borderRadius: "8px",
                border: "none",
                fontSize: "1rem",
                fontWeight: "bold",
                cursor: "pointer",
                background: "var(--team-a)",
                color: "white",
              }}
            >
              Join
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Top bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 16px",
          background: "rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <span
            onClick={() => setScreen("home")}
            style={{ cursor: "pointer", color: "var(--gold)", fontWeight: "bold" }}
          >
            ♠ Chakri
          </span>
          <span style={{ color: "var(--text-dim)" }}>
            Room: <b style={{ color: "var(--gold)" }}>{roomId}</b>
          </span>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: connected ? "#4ade80" : "#f87171",
              display: "inline-block",
            }}
          />
        </div>
        {state && (
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <span style={{ color: "var(--team-a)" }}>
              Team A: {state.scores?.[0] ?? 0} ({state.teamTricks?.[0] ?? 0} tricks)
            </span>
            <span style={{ color: "var(--team-b)" }}>
              Team B: {state.scores?.[1] ?? 0} ({state.teamTricks?.[1] ?? 0} tricks)
            </span>
          </div>
        )}
      </div>

      {/* Error flash */}
      {error && (
        <div
          style={{
            position: "absolute",
            top: "50px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 200,
            background: "#e0654a",
            color: "white",
            padding: "8px 20px",
            borderRadius: "8px",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      {/* Main game area */}
      {!state || state.phase === "waiting" ? (
        <Lobby state={state} send={send} yourName={playerName} />
      ) : (
        <GameTable state={state} send={send} />
      )}
    </div>
  );
}
