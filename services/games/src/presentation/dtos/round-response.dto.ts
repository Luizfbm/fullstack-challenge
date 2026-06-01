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

  @ApiProperty({ example: 25000, nullable: true })
  crashPointBp!: number | null;

  @ApiProperty({ example: "EXPONENTIAL" })
  multiplierCurve!: "EXPONENTIAL";

  @ApiProperty({ example: 10000 })
  multiplierBaseBp!: number;

  @ApiProperty({
    description: "Exponential growth rate in basis points per second.",
    example: 1500,
  })
  multiplierGrowthRateBpPerSecond!: number;

  @ApiProperty({
    description: "Committed server seed hash used to verify the revealed seed.",
  })
  serverSeedHash!: string;

  @ApiProperty({
    description: "Revealed server seed after the round is settled.",
    nullable: true,
  })
  serverSeed!: string | null;

  @ApiProperty({
    description: "Public client seed used by the provably fair calculation.",
  })
  clientSeed!: string;

  @ApiProperty({ description: "Round nonce used by the provably fair hash." })
  nonce!: number;

  @ApiProperty({ description: "Monotonic hash-chain round index." })
  chainIndex!: number;

  @ApiProperty({
    description: "Commitment hash for the next round seed when available.",
    nullable: true,
  })
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

  @ApiProperty({ nullable: true })
  crashPointBp!: number | null;

  @ApiProperty({ nullable: true })
  recalculatedCrashPointBp!: number | null;

  @ApiProperty({ nullable: true })
  serverSeedMatchesCommitment!: boolean | null;

  @ApiProperty({ nullable: true })
  fair!: boolean | null;
}
