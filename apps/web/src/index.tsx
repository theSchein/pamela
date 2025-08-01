import { createRoot } from "react-dom/client";
import "./index.css";
import Portfolio from "./components/Portfolio";
import Chat from "./components/Chat";
import TradeHistory from "./components/TradeHistory";
import ErrorBoundary from "./ErrorBoundary";

function App() {
  console.log("App component rendering!");
  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f0f0f0' }}>
      <Portfolio />
      <Chat />
      <TradeHistory />
    </div>
  );
}

const rootElement = document.getElementById("root");
console.log("Root element:", rootElement);
if (rootElement) {
  console.log("Rendering App...");
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
} else {
  console.error("Root element not found!");
}