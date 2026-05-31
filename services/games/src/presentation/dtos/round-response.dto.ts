import { ApiProperty } from "@nestjs/swagger";
import type { RoundStatus } from "../../domain/round";
import { BetResponseDto } from "./bet-response.dto";

export class RoundResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ["BETTING", "RUNNING", "CRASHED", "SETTLED"] })
  status!: RoundStatus;

  @ApiProperty()
  bettingStartsAt!: string;

  @ApiProperty()
  bettingEndsAt!: string;

  @ApiProperty({ nullable: true })
  startedAt!: string | null;

  @ApiProperty({ nullable: true })
  crashedAt!: string | null;

  @ApiProperty({ example: 25000 })
  crashPointBp!: number;

  @ApiProperty()
  serverSeedHash!: string;

  @ApiProperty({ nullable: true })
  serverSeed!: string | null;

  @ApiProperty()
  clientSeed!: string;

  @ApiProperty()
  nonce!: number;

  @ApiProperty()
  chainIndex!: number;

  @ApiProperty({ nullable: true })
  nextServerSeedHash!: string | null;

  @ApiProperty({ type: [BetResponseDto] })
  bets!: BetResponseDto[];
}

export class VerifyRoundResponseDto {
  @ApiProperty()
  roundId!: string;

  @ApiProperty({ enum: ["BETTING", "RUNNING", "CRASHED", "SETTLED"] })
  status!: RoundStatus;

  @ApiProperty()
  revealed!: boolean;

  @ApiProperty()
  serverSeedHash!: string;

  @ApiProperty({ nullable: true })
  serverSeed!: string | null;

  @ApiProperty()
  clientSeed!: string;

  @ApiProperty()
  nonce!: number;

  @ApiProperty()
  chainIndex!: number;

  @ApiProperty({ nullable: true })
  nextServerSeedHash!: string | null;

  @ApiProperty()
  algorithm!: string;

  @ApiProperty()
  houseEdgeBp!: number;

  @ApiProperty()
  crashPointBp!: number;

  @ApiProperty({ nullable: true })
  recalculatedCrashPointBp!: number | null;

  @ApiProperty({ nullable: true })
  serverSeedMatchesCommitment!: boolean | null;

  @ApiProperty({ nullable: true })
  fair!: boolean | null;
}
