// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "../ui/button";
import { BetModeToggle } from "./bet-mode-toggle";
import { BetStakePreview } from "./bet-stake-preview";

describe("casino surface contracts", () => {
  afterEach(() => {
    cleanup();
  });

  it("defines felt green and gold semantic casino surfaces", () => {
    const styles = readFileSync("src/styles.css", "utf8");

    expect(styles).toContain("--casino-felt: #064e3b;");
    expect(styles).toContain("--casino-gold: #facc15;");
    expect(styles).toContain("--casino-tech: #22d3ee;");
    expect(styles).toContain(".casino-bet-slip");
  });

  it("uses gold and felt treatments for the primary bet surface controls", () => {
    render(
      <>
        <Button type="button" variant="temporal">
          Apostar
        </Button>
        <Button type="button" variant="neon">
          Entrar para jogar
        </Button>
      </>,
    );

    const betButton = screen.getByRole("button", { name: "Apostar" });
    const loginButton = screen.getByRole("button", {
      name: "Entrar para jogar",
    });

    expect(betButton.className).toContain("border-amber-200/70");
    expect(betButton.className).toContain("from-amber-200");
    expect(betButton.className).not.toContain("rose");
    expect(loginButton.className).toContain("border-amber-200/35");
    expect(loginButton.className).not.toContain("border-rose");
  });

  it("keeps segmented betting and stake preview aligned with amber felt styling", () => {
    render(<BetModeToggle onChange={vi.fn()} value="manual" />);

    const manual = screen.getByRole("button", { name: "Manual" });
    const auto = screen.getByRole("button", { name: "Auto" });

    expect(manual.className).toContain("focus-visible:outline-amber-200");
    expect(manual.className).toContain("border-amber-200/45");
    expect(auto.className).toContain("hover:bg-emerald-950/55");

    cleanup();

    render(<BetStakePreview entryLabel="R$ 10,00" potentialPayout={2000n} />);

    const entry = screen.getByText("Entrada").parentElement;

    expect(entry?.className).toContain("border-amber-200/15");
  });
});
