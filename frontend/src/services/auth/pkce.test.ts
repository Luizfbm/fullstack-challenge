import { describe, expect, it } from "vitest";
import { createCodeChallenge } from "./pkce";

describe("PKCE helpers", () => {
  it("creates the RFC 7636 S256 code challenge", async () => {
    await expect(
      createCodeChallenge(
        "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
      ),
    ).resolves.toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});
