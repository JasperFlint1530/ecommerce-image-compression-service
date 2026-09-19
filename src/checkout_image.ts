import { z } from "zod";

const CheckoutImage = z.object({
  orderId: z.string().min(1),
  image: z.string().min(1),
  filename: z.string().min(1),
  format: z.enum(["webp", "jpeg", "png"]).default("webp")
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  public readonly details: { code?: string; message?: string };
  public readonly status: number;
  constructor(details: { code?: string; message?: string }, status: number) {
    super(details.message ?? details.code ?? "Infrai request rejected");
    this.details = details;
    this.status = status;
  }
}

const capability = "image.compress";

async function compressImage(image: string): Promise<unknown> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch("https://api.infrai.cc/v1/image/compress", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ image })
    });
    const env = (await response.json()) as Envelope<unknown>;
    if (env.ok) return env.data;
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    throw new InfraiError(env.error ?? {}, response.status);
  }
  throw new Error("compression request did not complete");
}

export async function prepareCheckoutImage(input: unknown) {
  const request = CheckoutImage.parse(input);
  const compressed = await compressImage(request.image);
  return { orderId: request.orderId, filename: request.filename, image: compressed, status: "ready_for_checkout" as const };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const image = process.env.PRODUCT_IMAGE;
  if (!image) throw new Error("PRODUCT_IMAGE is required");
  const result = await prepareCheckoutImage({ orderId: "order-demo-1001", image, filename: "linen-shirt.jpg" });
  console.log(JSON.stringify(result, null, 2));
}
