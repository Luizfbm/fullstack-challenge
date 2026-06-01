import { ApiProperty } from "@nestjs/swagger";

export class LeaderboardEntryDto {
  @ApiProperty({ example: 1 })
  rank!: number;

  @ApiProperty()
  playerId!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ example: "1500" })
  profitCents!: string;

  @ApiProperty({ example: "1000" })
  wageredCents!: string;

  @ApiProperty({ example: "2500" })
  payoutCents!: string;

  @ApiProperty({ example: 3 })
  betsCount!: number;
}
