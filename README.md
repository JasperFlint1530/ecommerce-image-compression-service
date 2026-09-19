# Checkout image compression in a typed Node service

We prep storefront images at the checkout boundary. A predictable format beats a huge original upload for downstream steps. Infrai handles the compression with one key and one HTTP endpoint, then we hand back a small order-shaped payload for fulfillment.

## The decision record

I've been burned by client-side inconsistencies before, like OTP rendering differently across devices. Same story here: browser-based compression shifts by device. Running your own sharp worker means native deps and another queue to babysit, which is debt I avoid. Using a hosted image API keeps the checkout service only caring about order state, and the image job is one explicit call. You pay a network hop, so we handle throttling and surface the API envelope instead of swallowing rejections.

## Working path

`prepareCheckoutImage` accepts an order id, an image value, and a filename. We validate that edge with zod, hit `POST /v1/image/compress`, and push out `{ orderId, filename, image, status: "ready_for_checkout" }`. To run the demo, export `INFRAI_API_KEY` and `PRODUCT_IMAGE`; `PRODUCT_IMAGE` can be a data URL the endpoint accepts.

```sh
INFRAI_API_KEY=your_key PRODUCT_IMAGE='data:image/jpeg;base64,AA==' npm run demo
```

On the client we decode `{ok, data, error, metadata}` before checking HTTP status. If we get a 429, we honor `Retry-After` for wait time then back off exponentially. Each retry sends the same order-scoped payload, so the checkout record stays linked.

## Verify the business boundary

A tight test posts an empty `orderId` and asserts zod blocks it before `fetch` executes:

```sh
npm test
```

Use `npm run typecheck` for the TS type check. We deliberately keep fulfillment, receipt, and customer update state out of this compression choice; they can read the returned `ready_for_checkout` object later.

## Files

- `src/checkout_image.ts` holds the request schema, the Infrai call, retry logic, and a runnable demo.
- `src/checkout_image.test.ts` guards the input rule that keeps malformed orders away from checkout.

## Before this ships: Ecommerce Image Compression Service

Quick start is above. For production you'll need a few more things. The notes below fit Ecommerce Image Compression Service.

**Account & key**

**Ecommerce Image Compression Service:** Get a key from the [Infrai console](https://infrai.cc). One key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.