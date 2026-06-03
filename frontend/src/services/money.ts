const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

export function formatCents(cents: bigint | number | string): string {
  return currencyFormatter.format(Number(BigInt(cents)) / 100);
}

export function formatCentsForRealInput(cents: bigint | number | string): string {
  const normalizedCents = BigInt(cents);
  const reais = normalizedCents / 100n;
  const centavos = normalizedCents % 100n;

  return `${reais.toString()},${centavos.toString().padStart(2, "0")}`;
}

export function normalizeCentsInput(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

  return digits || "0";
}

export function parseRealInputToCents(value: string): string {
  const normalized = value.trim().replace(/\s/g, "");

  if (!normalized) {
    return "0";
  }

  const commaIndex = normalized.lastIndexOf(",");
  const dotIndex = normalized.lastIndexOf(".");
  const separatorIndex = Math.max(commaIndex, dotIndex);
  const fractionDigits =
    separatorIndex >= 0
      ? normalized.slice(separatorIndex + 1).replace(/\D/g, "")
      : "";
  const hasDecimalSeparator =
    separatorIndex >= 0 &&
    fractionDigits.length >= 1 &&
    fractionDigits.length <= 2;

  if (!hasDecimalSeparator) {
    return `${BigInt(normalizeCentsInput(normalized)) * 100n}`;
  }

  const reaisDigits = normalizeCentsInput(normalized.slice(0, separatorIndex));
  const centavosDigits = fractionDigits.padEnd(2, "0").slice(0, 2);
  const cents = BigInt(reaisDigits) * 100n + BigInt(centavosDigits);

  return cents.toString();
}
