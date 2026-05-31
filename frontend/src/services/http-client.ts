import { appConfig } from "../app/config";

export type AccessTokenProvider = () => Promise<string | null> | string | null;

export type ApiRequestOptions = RequestInit & {
  auth?: boolean;
};

export type HttpClientOptions = {
  baseUrl?: string;
  fetcher?: typeof fetch;
  getAccessToken?: AccessTokenProvider;
};

let apiAccessTokenProvider: AccessTokenProvider | null = null;

export function setApiAccessTokenProvider(
  provider: AccessTokenProvider | null,
): void {
  apiAccessTokenProvider = provider;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly getAccessToken?: AccessTokenProvider;

  constructor(options: HttpClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? appConfig.apiBaseUrl);
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.getAccessToken = options.getAccessToken;
  }

  async request<T>(
    path: string,
    { auth = false, headers, body, ...init }: ApiRequestOptions = {},
  ): Promise<T> {
    const requestHeaders = new Headers(headers);

    if (body && !requestHeaders.has("Content-Type")) {
      requestHeaders.set("Content-Type", "application/json");
    }

    if (auth) {
      const token = await (this.getAccessToken ?? apiAccessTokenProvider)?.();

      if (token) {
        requestHeaders.set("Authorization", `Bearer ${token}`);
      }
    }

    const response = await this.fetcher(buildUrl(this.baseUrl, path), {
      ...init,
      body,
      headers: requestHeaders,
    });

    if (!response.ok) {
      throw new ApiError(
        `API request failed with ${response.status}`,
        response.status,
        await readResponseBody(response),
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await readResponseBody(response)) as T;
  }
}

export const apiClient = new HttpClient();

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}
