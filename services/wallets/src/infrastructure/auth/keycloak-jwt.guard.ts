import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";
import type { AuthenticatedUser } from "./authenticated-user";

type RequestWithHeadersAndUser = {
  headers: {
    authorization?: string;
  };
  user?: AuthenticatedUser;
};

@Injectable()
export class KeycloakJwtGuard implements CanActivate {
  private readonly issuer =
    process.env.KEYCLOAK_ISSUER ??
    "http://localhost:8080/realms/crash-game";

  private readonly clientId =
    process.env.KEYCLOAK_CLIENT_ID ?? "crash-game-client";

  private readonly jwksUrl =
    process.env.KEYCLOAK_JWKS_URL ??
    `${this.issuer}/protocol/openid-connect/certs`;

  private readonly jwks = createRemoteJWKSet(
    new URL(this.jwksUrl),
  );

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<RequestWithHeadersAndUser>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const { payload } = await this.verifyToken(token);
    request.user = this.toAuthenticatedUser(payload);

    return true;
  }

  private extractBearerToken(authorization?: string): string | null {
    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      return null;
    }

    return token;
  }

  private async verifyToken(token: string): Promise<{ payload: JWTPayload }> {
    try {
      const result = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
      });

      if (result.payload.azp !== this.clientId) {
        throw new UnauthorizedException("Invalid token client");
      }

      return { payload: result.payload };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException("Invalid bearer token");
    }
  }

  private toAuthenticatedUser(payload: JWTPayload): AuthenticatedUser {
    if (!payload.sub) {
      throw new UnauthorizedException("Token subject is required");
    }

    const usernameClaim = payload.preferred_username;
    const emailClaim = payload.email;
    const username =
      typeof usernameClaim === "string"
        ? usernameClaim
        : typeof emailClaim === "string"
          ? emailClaim
          : payload.sub;

    return {
      playerId: payload.sub,
      username,
    };
  }
}
