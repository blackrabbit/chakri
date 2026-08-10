import React, { useState, useEffect, useRef, useCallback } from "react";
import Lobby from "./components/Lobby.jsx";
import GameTable from "./components/GameTable.jsx";
import Admin from "./components/Admin.jsx";
import Auth from "./components/Auth.jsx";

// polyfill for crypto.randomUUID() which is only available in secure contexts (HTTPS)
function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] ?? Math.random() * 256) & 0xf;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------------------------------------------------------------------------
// WebSocket game client hook
// ---------------------------------------------------------------------------
function useGameSocket(roomId, playerName, authToken) {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const playerIdRef = useRef(localStorage.getItem("chakri-pid") || uuid());
  localStorage.setItem("chakri-pid", playerIdRef.current);

  useEffect(() => {
    if (!roomId) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${proto}//${window.location.host}/api/room/${roomId}?name=${encodeURIComponent(playerName)}&pid=${playerIdRef.current}${authToken ? `&token=${encodeURIComponent(authToken)}` : ""}`;

    let ws;
    let reconnectTimer;
    let disposed = false;

    function connect() {
      if (disposed) return;
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        // Send join immediately so the server registers this player
        ws.send(JSON.stringify({ type: "join" }));
      };
      ws.onclose = () => {
        setConnected(false);
        if (!disposed) reconnectTimer = setTimeout(connect, 2000);
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
      disposed = true;
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [roomId, playerName, authToken]);

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
  const initialRoom = new URLSearchParams(window.location.search).get("room") || "";
  const savedName = localStorage.getItem("chakri-name") || "";
  const savedToken = localStorage.getItem("chakri-token") || "";
  const [screen, setScreen] = useState(() => {
    if (window.location.pathname === "/admin") return "admin";
    return savedToken ? (initialRoom ? "game" : "home") : "auth";
  });
  const [roomId, setRoomId] = useState(initialRoom);
  const [playerName, setPlayerName] = useState(savedName);
  const [authToken, setAuthToken] = useState(savedToken);

  function openRoom(id) {
    window.history.replaceState({}, "", `/?room=${encodeURIComponent(id)}`);
  }

  useEffect(() => {
    if (!authToken || screen === "admin") return;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${authToken}` } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session expired");
        const account = await response.json();
        setPlayerName(account.username);
        localStorage.setItem("chakri-name", account.username);
      })
      .catch(() => {
        localStorage.removeItem("chakri-token");
        localStorage.removeItem("chakri-name");
        setAuthToken("");
        setPlayerName("");
        setRoomId("");
        setScreen("auth");
        window.history.replaceState({}, "", "/");
      });
  }, [authToken]);

  function leaveRoom() {
    send({ type: "leave" });
    setTimeout(() => {
      setRoomId("");
      setScreen("home");
      window.history.replaceState({}, "", "/");
    }, 100);
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: authToken }) });
    } catch {}
    localStorage.removeItem("chakri-token");
    localStorage.removeItem("chakri-name");
    setAuthToken("");
    setPlayerName("");
    setRoomId("");
    setScreen("auth");
    window.history.replaceState({}, "", "/");
  }

  const { state, connected, send, error } = useGameSocket(
    screen === "game" ? roomId : null,
    playerName,
    authToken
  );

  function createRoom() {
    if (!playerName.trim()) return;
    localStorage.setItem("chakri-name", playerName);
    const id = uuid().slice(0, 8);
    setRoomId(id);
    openRoom(id);
    setScreen("game");
  }

  function joinRoom() {
    if (!playerName.trim() || !roomId.trim()) return;
    localStorage.setItem("chakri-name", playerName);
    openRoom(roomId.trim());
    setScreen("game");
  }

  if (screen === "auth") {
    return <Auth onAuthenticated={(data) => { localStorage.setItem("chakri-token", data.token); localStorage.setItem("chakri-name", data.account.name); setAuthToken(data.token); setPlayerName(data.account.name); setScreen("home"); }} />;
  }

  if (screen === "home") {
    return (
      <div className="home-page">
        <div className="home-toolbar"><div className="account-chip"><span className="account-avatar">{playerName[0]?.toUpperCase()}</span><span>Logged in as <strong>{playerName}</strong></span><button onClick={logout}>Log out</button></div></div>
        <div className="home-card">
          <div className="brand-mark">♠</div>
          <div className="eyebrow">★ ONLINE CARD ARCADE ★</div>
          <h1>Chakri</h1>
          <p className="home-subtitle">A modern 6-player Court Piece game.</p>
          <div className="home-form">
            <button className="primary-action" onClick={createRoom}>Create new room <span>▶</span></button>
            <div className="join-row">
              <input className="modern-input" type="text" placeholder="Room code" value={roomId} onChange={(e) => setRoomId(e.target.value)} maxLength={8} />
              <button className="secondary-action" onClick={joinRoom}>Join</button>
            </div>
          </div>
          <div className="home-footnote">Private rooms · Your PIN keeps your identity across devices</div>
        </div>
      </div>
    );
  }

  if (screen === "admin") {
    return <Admin />;
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
            onClick={leaveRoom}
            style={{ cursor: "pointer", color: "var(--gold)", fontWeight: "bold" }}
          >
            ♠ Chakri
          </span>
          <button className="leave-room-button" onClick={leaveRoom}>Leave room</button>
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
              Team A: {state.scores?.[0] ?? 0} ({state.teamTricks?.[0] ?? 0} hands)
            </span>
            <span style={{ color: "var(--team-b)" }}>
              Team B: {state.scores?.[1] ?? 0} ({state.teamTricks?.[1] ?? 0} hands)
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
        <Lobby state={state} send={send} yourName={playerName} roomId={roomId} />
      ) : (
        <GameTable state={state} send={send} />
      )}
    </div>
  );
}
