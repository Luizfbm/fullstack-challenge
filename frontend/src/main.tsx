import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-50">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">
            Crash Game
          </p>
          <h1 className="mt-4 text-4xl font-semibold">Preparing the table</h1>
          <p className="mt-3 text-sm text-zinc-400">
            Frontend scaffold is ready. Game experience comes next.
          </p>
        </div>
      </section>
    </main>
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
