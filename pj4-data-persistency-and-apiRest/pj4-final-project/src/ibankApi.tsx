import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { db } from "./prisma/db";

export const amountInputSchema = z
  .union([z.string(), z.number()])
  .refine((value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0;
  }, { message: "Amount must be a positive number" })
  .transform((value) => String(value));

export const balanceInputSchema = z
  .union([z.string(), z.number()])
  .refine((value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue >= 0;
  }, { message: "Balance must be a non-negative number" })
  .transform((value) => String(value));

export const accountSchema = z.object({
  accountId: z.number().int().positive(),
  cpf: z.string().trim().length(11),
  name: z.string().trim().min(1),
  balance: balanceInputSchema,
});

export const transferRequestSchema = z.object({
  senderId: z.number().int().positive(),
  recipientId: z.number().int().positive(),
  amount: amountInputSchema,
});

export const transactionSchema = z.object({
  id: z.number().int().positive().optional(),
  idempotencyKey: z.string().trim().min(1),
  recipientId: z.number().int().positive(),
  senderId: z.number().int().positive(),
  amount: amountInputSchema,
  executed: z.boolean().optional().default(false),
});

export type TransferRequest = z.infer<typeof transferRequestSchema>;
export type TransferPayload = z.infer<typeof transactionSchema>;
type BaseTxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];
type TxClient = BaseTxClient;

export async function lockAccountsInOrder(
  tx: TxClient,
  senderId: number,
  recipientId: number,
) {
  const firstId = Math.min(senderId, recipientId);
  const secondId = Math.max(senderId, recipientId);

  const firstRow = await tx.orm.public.CheckingAccount
    .where({ accountId: firstId })
    .forUpdate()
    .first();
  const secondRow = await tx.orm.public.CheckingAccount
    .where({ accountId: secondId })
    .forUpdate()
    .first();

  if (!firstRow || !secondRow) {
    throw new Error("One or both accounts were not found");
  }

  const senderRow = senderId === firstId ? firstRow : secondRow;
  const recipientRow = recipientId === firstId ? firstRow : secondRow;

  return {
    senderBalance: Number(senderRow.balance),
    recipientBalance: Number(recipientRow.balance),
  };
}

export async function executeTransferTx(
  tx: TxClient,
  payload: TransferPayload,
) {
  const { senderId, recipientId, amount, idempotencyKey } = payload;

  if (senderId === recipientId) {
    throw new Error("Sender and recipient cannot be the same account");
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Amount must be a positive number");
  }

  let transactionRow = await tx.orm.public.Transaction
    .where({ idempotencyKey })
    .forUpdate()
    .first();

  if (!transactionRow) {
    const idSeed = createHash("sha256")
      .update(idempotencyKey)
      .digest("hex")
      .slice(0, 8);
    const id = (Number.parseInt(idSeed, 16) % 2_147_483_646) + 1;

    try {
      transactionRow = await tx.orm.public.Transaction.create({
        id,
        idempotencyKey,
        senderId,
        recipientId,
        amount: numericAmount.toFixed(2),
        executed: false,
      });
    } catch {
      return { status: "DUPLICATE" as const, idempotencyKey };
    }
  }

  if (
    Number(transactionRow.senderId) !== senderId ||
    Number(transactionRow.recipientId) !== recipientId ||
    Number(transactionRow.amount) !== numericAmount
  ) {
    throw new Error("Idempotency-Key was already used with a different transfer");
  }

  if (transactionRow.executed) {
    return { status: "DUPLICATE" as const, idempotencyKey };
  }

  const { senderBalance, recipientBalance } =
    await lockAccountsInOrder(tx, senderId, recipientId);

  if (senderBalance < numericAmount) {
    throw new Error("Sender has insufficient balance");
  }

  await tx.orm.public.CheckingAccount
    .where({ accountId: senderId })
    .update({ balance: (senderBalance - numericAmount).toFixed(2) });

  await tx.orm.public.CheckingAccount
    .where({ accountId: recipientId })
    .update({ balance: (recipientBalance + numericAmount).toFixed(2) });

  await tx.orm.public.Transaction
    .where({ idempotencyKey })
    .update({ executed: true });

  return { status: "EXECUTED" as const, idempotencyKey };
}

export async function runTransfer(payload: TransferPayload) {
  return db.transaction(async (tx) => executeTransferTx(tx, payload));
}

export function createServer() {
  const app = Fastify({ logger: true });

  app.post("/transfers", async (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => {
    const header = request.headers["idempotency-key"];
    const idempotencyKey = typeof header === "string" ? header.trim() : "";

    if (!idempotencyKey) {
      return reply.status(400).send({
        error: "Idempotency-Key header is required",
      });
    }

    const parsedBody = transferRequestSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "Invalid transfer payload",
        issues: parsedBody.error.flatten().fieldErrors,
      });
    }

    const payload = transactionSchema.parse({
      ...parsedBody.data,
      idempotencyKey,
    });

    try {
      const result = await runTransfer(payload);
      return reply.status(result.status === "DUPLICATE" ? 200 : 201).send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transfer failed";

      if (message.includes("Idempotency-Key")) {
        return reply.status(409).send({ error: message });
      }
      if (message.includes("insufficient balance")) {
        return reply.status(422).send({ error: message });
      }
      if (message.includes("not found")) {
        return reply.status(404).send({ error: message });
      }
      if (message.includes("same account")) {
        return reply.status(400).send({ error: message });
      }

      request.log.error(error);
      return reply.status(500).send({ error: "Internal transfer error" });
    }
  });

  return app;
}

export async function startServer() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  await db.connect({ url: databaseUrl });

  const app = createServer();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: "0.0.0.0" });

  return app;
}

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  startServer().catch(async (error) => {
    console.error(error);
    await db.close();
    process.exit(1);
  });
}
