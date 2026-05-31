import { ApiError } from "./http-client";

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Sessao expirada. Entre novamente para continuar.";
    }

    const bodyMessage = readBodyMessage(error.body);

    return bodyMessage ?? `Falha na API (${error.status}).`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Falha inesperada.";
}

function readBodyMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const message = (body as { message?: unknown }).message;

  if (typeof message === "string") {
    return message;
  }

  if (Array.isArray(message)) {
    return message.filter((item) => typeof item === "string").join(", ");
  }

  return null;
}
