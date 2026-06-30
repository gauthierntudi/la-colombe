import { z } from "zod";
import { prisma } from "@ges/database";
import {
  createAccessToken,
  createRefreshToken,
  serializeUser,
  verifyRefreshToken,
} from "@/lib/auth";
import { formatApiError } from "@/lib/api-utils";

const schema = z.object({ refreshToken: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const { refreshToken } = schema.parse(await request.json());
    const payload = await verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { pointOfSales: { include: { pointOfSale: true } } },
    });

    if (!user || !user.active) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Utilisateur introuvable" } },
        { status: 401 }
      );
    }

    const [accessToken, newRefreshToken] = await Promise.all([
      createAccessToken(user),
      createRefreshToken(user),
    ]);

    return Response.json({
      accessToken,
      refreshToken: newRefreshToken,
      user: await serializeUser(user),
    });
  } catch (error) {
    return formatApiError(error);
  }
}
