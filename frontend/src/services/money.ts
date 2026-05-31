const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

export function formatCents(cents: bigint | number | string): string {
  return currencyFormatter.format(Number(BigInt(cents)) / 100);
}

export function normalizeCentsInput(value: string): string {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

  return digits || "0";
}
