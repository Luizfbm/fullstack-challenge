import { Wallet } from "../../domain/wallet";
import { WalletTransaction } from "../../domain/wallet-transaction";

export interface WalletRepository {
  findByPlayerId(playerId: string): Promise<Wallet | null>;
  create(wallet: Wallet, transaction: WalletTransaction | null): Promise<void>;
  save(wallet: Wallet, transaction: WalletTransaction | null): Promise<void>;
}
