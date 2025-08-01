import { createRoot } from "react-dom/client";
import "./index.css";
import React from "react";
import Portfolio from "./components/Portfolio";
import Chat from "./components/Chat";
import TradeHistory from "./components/TradeHistory";

function App() {
  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f0f0f0' }}>
      <Portfolio />
      <Chat />
      <TradeHistory />
    </div>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
}