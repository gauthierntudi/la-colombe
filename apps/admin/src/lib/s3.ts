import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { toAssetUrl } from "./assets";

function getS3Config() {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.S3_REGION ?? "us-east-1";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Configuration S3 incomplète (S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)");
  }

  return { bucket, region, accessKeyId, secretAccessKey };
}

let client: S3Client | null = null;

export function getS3Client() {
  if (!client) {
    const { region, accessKeyId, secretAccessKey } = getS3Config();
    client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return client;
}

export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const { bucket } = getS3Config();

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return toAssetUrl(key);
}

export async function getObjectFromS3(key: string) {
  const { bucket } = getS3Config();
  return getS3Client().send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}
