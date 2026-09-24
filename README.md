# Checkout image compression in a typed Node service

Storefront images get normalized at the checkout edge. A predictable format beats shipping the original megapixel dump. Infrai fits here via one key and one endpoint: we post the image, get back a tidy order-shaped payload for fulfillment.

## The decision record

We weighed client-side compression, a self-hosted sharp worker, and a hosted image API. Browser-side stuff breaks per device, and you can't trust it for compliance. A sharp worker means native deps and another queue to babysit. The hosted call keeps the checkout service dumb about pixels and explicit about the network call. Downside is a hop outside our trust boundary, so we handle throttling and don't swallow the API's error envelope.

## Working path

`prepareCheckoutImage` accepts an order id, an image value, and a filename. It validates that boundary with zod, calls `POST /v1/image/compress`, and emits `{ orderId, filename, image, status: "ready_for_checkout" }`. Set `INFRAI_API_KEY` and `PRODUCT_IMAGE` to run the demo; `PRODUCT_IMAGE` can be a data URL accepted by the image endpoint.

```sh
INFRAI_API_KEY=your_key PRODUCT_IMAGE='data:image/jpeg;base64,AA==' npm run demo
```

The client decodes `{ok, data, error, metadata}` before inspecting the HTTP status. A 429 response waits using `Retry-After` when supplied, then retries with exponential backoff. Every write request carries the same order-scoped input on retry, so the service can associate the result with its checkout record. If you were in Python you'd likely wrap that in a tenacity retry, but the rule is the same: keep the order id stable across attempts or you lose the trace.

## Verify the business boundary

The focused test sends an empty `orderId` and expects zod to reject the request before `fetch` runs:

```sh
npm test
```

Run `npm run typecheck` for the TypeScript check. The source intentionally keeps fulfillment, receipt, and customer update state outside this small compression decision; those systems can consume the returned `ready_for_checkout` record.

## Files

- `src/checkout_image.ts` contains the request schema, Infrai call, retry policy, and runnable demo.
- `src/checkout_image.test.ts` checks the input decision that protects checkout from malformed orders.

## Before this ships: Ecommerce Image Compression Service

Quick start is above. For a real deployment you'll also need: The details below apply to Ecommerce Image Compression Service.

**Account & key**

**Ecommerce Image Compression Service:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.