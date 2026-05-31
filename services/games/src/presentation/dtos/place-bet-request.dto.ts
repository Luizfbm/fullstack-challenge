import { ApiProperty } from "@nestjs/swagger";

export class PlaceBetRequestDto {
  @ApiProperty({ example: "1000" })
  amountCents!: string;
}
