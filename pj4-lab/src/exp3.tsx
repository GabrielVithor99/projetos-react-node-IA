
import {db} from './prisma/db';

async function redeemVoucherIsolated(
  voucherCode: string,
  amount: number,
  idempotencyKey: string,
) {
  return db.transaction(async (tx) => {
    const existing = await tx.orm.public.VoucherRedemption
      .where({ idempotencyKey })
      .first();

    if (existing) {
      return existing;
    }

    const voucher = await tx.orm.public.Voucher
      .where({ code: voucherCode })
      .forUpdate()
      .first();

    if (!voucher) {
      throw new Error("Voucher not found");
    }

    const balance = Number(voucher.balance);
    if (!Number.isFinite(balance) || balance < amount) {
      throw new Error("Insufficient voucher balance");
    }

    await tx.orm.public.Voucher
      .where({ code: voucherCode })
      .update({
        balance: (balance - amount).toFixed(2),
      });

    return tx.orm.public.VoucherRedemption.create({
      idempotencyKey,
      voucherCode,
      amount: amount.toFixed(2),
    });
  });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  await db.connect({ url: databaseUrl });

  const existingVoucher = await db.orm.public.Voucher
    .where({ code: "VOUCHER123" })
    .first();

  if (!existingVoucher) {
    await db.orm.public.Voucher.create({
      code: "VOUCHER123",
      balance: "100.00",
    });
  }

  return redeemVoucherIsolated("VOUCHER123", 50, "unique-key-123");
}

main()
  .then((redemption) => {
    console.log("Voucher redeemed successfully", redemption);
  })
  .catch((error) => {
    console.error("Error redeeming voucher:", error);
  })
  .finally(async () => {
    await db.close();
  });