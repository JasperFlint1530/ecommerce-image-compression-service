import test from "node:test";
import assert from "node:assert/strict";
import { prepareCheckoutImage } from "./checkout_image.js";

test("checkout input rejects an empty order id before any API call", async () => {
  await assert.rejects(() => prepareCheckoutImage({ orderId: "", image: "data:image/jpeg;base64,AA==", filename: "item.jpg" }));
});
