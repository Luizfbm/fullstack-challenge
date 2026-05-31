import { createHash, createHmac } from "node:crypto";

type CrashPointInput = {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  houseEdgeBp: number;
};

export class ProvablyFair {
  static hashSeed(seed: string): string {
    return createHash("sha256").update(seed).digest("hex");
  }

  static buildHashChain(seed: string, size: number): string[] {
    if (!Number.isInteger(size) || size <= 0) {
      throw new Error("Hash chain size must be a positive integer");
    }

    const chain = [seed];

    while (chain.length < size) {
      chain.push(ProvablyFair.hashSeed(chain[chain.length - 1]));
    }

    return chain;
  }

  static verifySeed(serverSeed: string, serverSeedHash: string): boolean {
    return ProvablyFair.hashSeed(serverSeed) === serverSeedHash;
  }

  static calculateCrashPointBp(input: CrashPointInput): number {
    if (!Number.isInteger(input.houseEdgeBp) || input.houseEdgeBp < 0) {
      throw new Error("House edge must be a non-negative integer");
    }

    if (input.houseEdgeBp >= 10000) {
      throw new Error("House edge must be lower than 100%");
    }

    const digest = createHmac("sha256", input.serverSeed)
      .update(`${input.clientSeed}:${input.nonce}`)
      .digest("hex");
    const sample = BigInt(`0x${digest.slice(0, 13)}`);
    const maxSample = 2n ** 52n;
    const numerator = maxSample * BigInt(10000 - input.houseEdgeBp);
    const denominator = maxSample - sample;
    const multiplierBp = Number(numerator / denominator);

    return Math.max(10000, multiplierBp);
  }
}
