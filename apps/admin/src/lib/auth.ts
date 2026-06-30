import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma, Role, User } from "@ges/database";
import { resolveAssetUrl } from "./assets";
import { ApiError } from "./api-utils";

const ACCESS_TTL = "15m";
const REFRESH_TTL = "7d";

function getSecret(key: string): Uint8Array {
  const value = process.env[key];
  if (!value || value.length < 32) {
    throw new Error(`${key} must be set (min 32 chars)`);
  }
  return new TextEncoder().encode(value);
}

export type TokenPayload = {
  sub: string;
  email: string;
  role: Role;
  type: "access" | "refresh";
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createAccessToken(user: Pick<User, "id" | "email" | "role">) {
  return new SignJWT({
    email: user.email,
    role: user.role,
    type: "access",
  } satisfies Omit<TokenPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(getSecret("JWT_SECRET"));
}

export async function createRefreshToken(user: Pick<User, "id" | "email" | "role">) {
  return new SignJWT({
    email: user.email,
    role: user.role,
    type: "refresh",
  } satisfies Omit<TokenPayload, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .sign(getSecret("JWT_REFRESH_SECRET"));
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(token, getSecret("JWT_SECRET"));
    if (payload.type !== "access") {
      throw new ApiError("UNAUTHORIZED", "Token invalide", 401);
    }
    return payload as unknown as TokenPayload;
  } catch {
    throw new ApiError("UNAUTHORIZED", "Token expiré ou invalide", 401);
  }
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(token, getSecret("JWT_REFRESH_SECRET"));
    if (payload.type !== "refresh") {
      throw new ApiError("UNAUTHORIZED", "Refresh token invalide", 401);
    }
    return payload as unknown as TokenPayload;
  } catch {
    throw new ApiError("UNAUTHORIZED", "Refresh token expiré ou invalide", 401);
  }
}

export async function getAuthUser(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError("UNAUTHORIZED", "Authentification requise", 401);
  }

  const token = header.slice(7);
  const payload = await verifyAccessToken(token);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      pointOfSales: {
        include: { pointOfSale: true },
      },
    },
  });

  if (!user || !user.active) {
    throw new ApiError("UNAUTHORIZED", "Utilisateur introuvable ou inactif", 401);
  }

  return user;
}

export function requireRole(userRole: Role, ...allowed: Role[]) {
  if (!allowed.includes(userRole)) {
    throw new ApiError("FORBIDDEN", "Permissions insuffisantes", 403);
  }
}

export async function serializeUser(user: {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: Role;
  pointOfSales?: { pointOfSale: { id: string; code: string; name: string; type: string } }[];
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: resolveAssetUrl(user.avatarUrl),
    role: user.role,
    pointOfSales:
      user.pointOfSales?.map((p) => ({
        id: p.pointOfSale.id,
        code: p.pointOfSale.code,
        name: p.pointOfSale.name,
        type: p.pointOfSale.type,
      })) ?? [],
  };
}
