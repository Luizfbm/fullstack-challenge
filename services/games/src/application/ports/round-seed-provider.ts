export type RoundSeedMaterial = {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  crashPointBp: number;
  nextServerSeedHash: string | null;
};

export interface RoundSeedProvider {
  getRoundSeed(chainIndex: number): RoundSeedMaterial;
  getServerSeed(chainIndex: number): string;
}
