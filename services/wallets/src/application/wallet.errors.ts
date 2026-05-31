export class WalletNotFoundError extends Error {
  constructor(playerId: string) {
    super(`Wallet not found for player ${playerId}`);
    this.name = "WalletNotFoundError";
  }
}
