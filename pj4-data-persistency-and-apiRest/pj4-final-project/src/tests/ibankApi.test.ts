import assert from "node:assert/strict";
import { db } from "../prisma/db";
import { createServer, transactionSchema } from "../ibankApi";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, "DATABASE_URL is not configured");

  await db.connect({ url: databaseUrl });
  const app = createServer();

  try {
    const missingKey = await app.inject({
      method: "POST",
      url: "/transfers",
      payload: {
        senderId: 1,
        recipientId: 2,
        amount: "0.01",
      },
    });
    assert.equal(missingKey.statusCode, 400);

    const invalidPayload = await app.inject({
      method: "POST",
      url: "/transfers",
      headers: { "idempotency-key": `api-invalid-${crypto.randomUUID()}` },
      payload: {
        senderId: 1,
        recipientId: 2,
        amount: "-1",
      },
    });
    assert.equal(invalidPayload.statusCode, 400);

    const key = `api-test-${crypto.randomUUID()}`;
    const payload = {
      senderId: 1,
      recipientId: 2,
      amount: "0.01",
    };
    const parsedPayload = transactionSchema.parse({
      ...payload,
      idempotencyKey: key,
    });
    assert.equal(parsedPayload.executed, false);

    const results = await Promise.all([
      app.inject({
        method: "POST",
        url: "/transfers",
        headers: { "idempotency-key": key },
        payload,
      }),
      app.inject({
        method: "POST",
        url: "/transfers",
        headers: { "idempotency-key": key },
        payload,
      }),
      app.inject({
        method: "POST",
        url: "/transfers",
        headers: { "idempotency-key": key },
        payload,
      }),
    ]);

    assert.equal(results.filter((result) => result.statusCode === 201).length, 1);
    assert.ok(results.every((result) =>
      result.statusCode === 201 || result.statusCode === 200,
    ));

    const repeated = await app.inject({
      method: "POST",
      url: "/transfers",
      headers: { "idempotency-key": key },
      payload,
    });
    assert.equal(repeated.statusCode, 200);
    assert.equal(repeated.json().status, "DUPLICATE");

    console.log("ibankApi.test: passed");
  } finally {
    await app.close();
    await db.close();
  }
}

main().catch((error) => {
  console.error("ibankApi.test: failed", error);
  process.exit(1);
});
