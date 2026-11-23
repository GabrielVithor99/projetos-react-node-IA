import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { db } from "../prisma/db";
import {
  runTransfer,
  transactionSchema,
  type TransferPayload,
} from "../ibank";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, "DATABASE_URL is not configured");

  await db.connect({ url: databaseUrl });

  try {
    const sender = await db.orm.public.CheckingAccount
      .where({ accountId: 1 })
      .first();
    const recipient = await db.orm.public.CheckingAccount
      .where({ accountId: 2 })
      .first();

    assert.ok(sender, "Account 1 is required for the ibank test");
    assert.ok(recipient, "Account 2 is required for the ibank test");

    const key = `ibank-test-${crypto.randomUUID()}`;
    const idSeed = createHash("sha256").update(key).digest("hex").slice(0, 8);
    const id = (Number.parseInt(idSeed, 16) % 2_147_483_646) + 1;
    const payload = transactionSchema.parse({
      idempotencyKey: key,
      senderId: 1,
      recipientId: 2,
      amount: "0.01",
    }) satisfies TransferPayload;

    assert.equal(payload.executed, false);

    await db.orm.public.Transaction.create({
      id,
      idempotencyKey: key,
      senderId: 1,
      recipientId: 2,
      amount: "0.01",
      executed: false,
    });

    const results = await Promise.all([
      runTransfer(payload),
      runTransfer(payload),
      runTransfer(payload),
    ]);

    assert.equal(results.length, 3);
    assert.equal(results.filter((result) => result?.status === "EXECUTED").length, 1);
    assert.ok(results.every((result) =>
      result?.status === "EXECUTED" || result?.status === "DUPLICATE",
    ));

    const repeated = await runTransfer(payload);
    assert.equal(repeated?.status, "DUPLICATE");

    console.log("ibank.test: passed");
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error("ibank.test: failed", error);
  process.exit(1);
});