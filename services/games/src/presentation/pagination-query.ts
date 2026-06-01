import { BadRequestException } from "@nestjs/common";

export function parsePositiveLimit(limit?: string): number | undefined {
  if (!limit) {
    return undefined;
  }

  const parsed = Number(limit);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestException("limit must be a positive integer");
  }

  return parsed;
}
