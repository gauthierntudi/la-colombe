import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@ges/database";
import {
  createAccessToken,
  createRefreshToken,
  serializeUser,
  verifyPassword,
  verifyRefreshToken,
} from "@/lib/auth";
import { formatApiError } from "@/lib/api-utils";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = loginSchema.parse(await request.json());

    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      include: {
        pointOfSales: { include: { pointOfSale: true } },
      },
    });

    if (!user || !user.active) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Email ou mot de passe incorrect" } },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Email ou mot de passe incorrect" } },
        { status: 401 }
      );
    }

    const [accessToken, refreshToken] = await Promise.all([
      createAccessToken(user),
      createRefreshToken(user),
    ]);

    return Response.json({
      accessToken,
      refreshToken,
      user: await serializeUser(user),
    });
  } catch (error) {
    return formatApiError(error);
  }
}
