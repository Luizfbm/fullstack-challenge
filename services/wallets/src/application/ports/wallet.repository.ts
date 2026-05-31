import { Wallet } from "../../domain/wallet";
import { WalletTransaction } from "../../domain/wallet-transaction";

export const WALLET_REPOSITORY = Symbol("WALLET_REPOSITORY");

export interface WalletRepository {
  findByPlayerId(playerId: string): Promise<Wallet | null>;
  create(wallet: Wallet, transaction: WalletTransaction | null): Promise<void>;
  save(wallet: Wallet, transaction: WalletTransaction | null): Promise<void>;
}
