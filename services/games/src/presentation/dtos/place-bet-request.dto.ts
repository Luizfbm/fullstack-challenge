import { ApiProperty } from "@nestjs/swagger";
import {
  MAX_AUTO_CASHOUT_MULTIPLIER_BP,
  MIN_AUTO_CASHOUT_MULTIPLIER_BP,
} from "../../application/auto-cashout";

export class PlaceBetRequestDto {
  @ApiProperty({ example: "1000" })
  amountCents!: string;

  @ApiProperty({
    description: "Optional auto cashout target multiplier in basis points.",
    example: 20000,
    maximum: MAX_AUTO_CASHOUT_MULTIPLIER_BP,
    minimum: MIN_AUTO_CASHOUT_MULTIPLIER_BP,
    nullable: true,
    required: false,
  })
  autoCashoutMultiplierBp?: number | null;
}
