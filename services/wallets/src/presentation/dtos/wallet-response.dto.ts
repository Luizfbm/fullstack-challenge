import { ApiProperty } from "@nestjs/swagger";

export class WalletResponseDto {
  @ApiProperty()
  playerId!: string;

  @ApiProperty({
    description: "Current wallet balance in cents, serialized as a string.",
    example: "100000",
  })
  balanceCents!: string;
}

export class CreateWalletResponseDto extends WalletResponseDto {
  @ApiProperty()
  created!: boolean;
}
