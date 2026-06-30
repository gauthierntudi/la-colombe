import { isAllowedAssetKey } from "@/lib/assets";
import { getObjectFromS3 } from "@/lib/s3";

type Params = { params: Promise<{ path: string[] }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { path } = await params;
    const key = path.join("/");

    if (!isAllowedAssetKey(key)) {
      return new Response("Not found", { status: 404 });
    }

    const object = await getObjectFromS3(key);
    const body = await object.Body?.transformToByteArray();

    if (!body) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(Buffer.from(body), {
      headers: {
        "Content-Type": object.ContentType ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    const err = error as { name?: string };
    if (err?.name === "NoSuchKey") {
      return new Response("Not found", { status: 404 });
    }
    console.error(error);
    return new Response("Error", { status: 500 });
  }
}
