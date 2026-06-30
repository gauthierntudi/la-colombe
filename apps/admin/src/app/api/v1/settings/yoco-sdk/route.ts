import { NextRequest } from "next/server";
import { getAuthUser, requireRole } from "@/lib/auth";
import { formatApiError } from "@/lib/api-utils";
import { getYocoSdkSettings } from "@/lib/services/settings.service";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    requireRole(user.role, "ADMIN", "MANAGER", "CAISSIER");

    const config = await getYocoSdkSettings();
    if (!config) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "SDK Yoco non configuré" } },
        { status: 404 }
      );
    }

    return Response.json(config);
  } catch (error) {
    return formatApiError(error);
  }
}
