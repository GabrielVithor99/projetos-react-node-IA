import { pathToFileURL } from "node:url";
import { z } from "zod";
import { db } from "./prisma/db";

const amountInputSchema = z.union([z.string(), z.number()]).refine(
  (value) => !Number.isNaN(Number(value)) && Number(value) > 0,
  { message: "Amount must be a positive number" }
).transform((value) => String(value));

const balanceInputSchema = z.union([z.string(), z.number()]).refine(
  (value) => !Number.isNaN(Number(value)) && Number(value) >= 0,
  { message: "Balance must be a non-negative number" }
).transform((value) => String(value));

const accountWithdrawSchema = z.object({
    accountId: z.number().int().positive(),
    cpf: z.string().trim().min(11).max(11),
    name: z.string().trim().min(1),
    balance: balanceInputSchema
});




export const transactionSchema = z.object({
    id: z.number().int().positive().optional(),
    idempotencyKey: z.string().trim().min(1),
    recipientId: z.number().int().positive(),
    senderId: z.number().int().positive(),
    amount:  amountInputSchema,
    executed: z.boolean().optional().default(false),
});

export type TransferPayload = z.infer<typeof transactionSchema>;
type TxClient = Parameters<Parameters<typeof db.transaction>[0]>[0];



//Criar contas de teste 4 validas e 4 inválidas
const sampleAccountPayloads: unknown[] = [
    { accountId: 1, cpf: '12345678901', name: 'Alice', balance: '100.00' }, // Válido
    { accountId: 2, cpf: '23456789012', name: 'Bob', balance: '200.50' }, // Válido
    { accountId: 3, cpf: '34567890123', name: 'Charlie', balance: '300.75' }, // Válido
    { accountId: 4, cpf: '45678901234', name: 'David', balance: '400.00' }, // Válido
    { accountId: -1, cpf: '56789012345', name: 'Eve', balance: '500.00' }, // Inválido (accountId negativo)
    { accountId: 5, cpf: '67890123456', name: '', balance: '600.00' }, // Inválido (nome vazio)
    { accountId: 6, cpf: '78901234567', name: 'Frank', balance: '-700.00' }, // Inválido (saldo negativo)
    { accountId: 7, cpf: '89012345678', name: 'Grace', balance: '800.00' }, // Inválido (cpf inválido)
];

//Criar transações de teste 4 validas e 4 inválidas
const sampleTransactionPayloads: unknown[] = [
    { id: 1, idempotencyKey: 'abc123', recipientId: 2, senderId: 1, amount: '50.00' }, // Válido
    { id: 2, idempotencyKey: 'def456', recipientId: 3, senderId: 2, amount: '75.25' }, // Válido
    { id: 3, idempotencyKey: 'ghi789', recipientId: 4, senderId: 3, amount: '100.50' }, // Válido
    { id: 4, idempotencyKey: 'jkl012', recipientId: 1, senderId: 4, amount: '25.75' }, // Válido
    { id: -1, idempotencyKey: 'mno345', recipientId: 2, senderId: 1, amount: '50.00' }, // Inválido (id negativo)
    { id: 5, idempotencyKey: '', recipientId: 3, senderId: 2, amount: '75.25' }, // Inválido (idempotencyKey vazio)
    { id: 6, idempotencyKey: 'pqr678', recipientId: -4, senderId: 3, amount: '100.50' }, // Inválido (recipientId negativo)
    { id: 7, idempotencyKey: 'stu901', recipientId: 1, senderId: 4, amount: '-25.75' }, // Inválido (amount negativo)
];

async function insertAccountsOnDatabase(accounts: unknown[]){
    for (const account of accounts) {
        const parsed = accountWithdrawSchema.safeParse(account);
        
        if (!parsed.success) {
            console.error("Invalid account payload:", parsed.error.flatten().fieldErrors);
            continue;
        }

        const validAccount = parsed.data;
        const accountExisting = await db.orm.public.CheckingAccount
        .where({ accountId: validAccount.accountId })
        .first();

        if (accountExisting) {
            console.log("Account already exists in database:", accountExisting);
            continue;
        }

        await db.orm.public.CheckingAccount.create({
            accountId: validAccount.accountId,
            cpf: validAccount.cpf,
            name: validAccount.name,
            balance: validAccount.balance,
        });

    }
}

async function insertTransactionsOnDatabase(transactions: unknown[]) {

    for(const transaction of transactions) {
        const parsed = transactionSchema.safeParse(transaction);
        if(!parsed.success) {
            console.error("Invalid transaction payload:", parsed.error.flatten().fieldErrors);
            continue;
        }
        const validTransaction = parsed.data;
        const transactionExisting = await db.orm.public.Transaction
        .where({ id: validTransaction.id })
        .first();
        if(transactionExisting) {
            console.log("Transaction already exists in database:", transactionExisting);
            continue;
        }

        console.log("Inserting valid transaction into database:", validTransaction);
        await db.orm.public.Transaction.create({
            id: validTransaction.id,
            idempotencyKey: validTransaction.idempotencyKey,
            recipientId: validTransaction.recipientId,
            senderId: validTransaction.senderId,
            amount: validTransaction.amount,
        });
    }
}
async function lookAccountInOrder(tx: TxClient, senderID:number, recipientID:number) {
    const firstId = Math.min(senderID, recipientID);
    const secondId = Math.max(senderID, recipientID);

    const firstRow = await tx.orm.public.CheckingAccount
        .where({ accountId: firstId })
        .forUpdate()
        .first();
    const secondRow = await tx.orm.public.CheckingAccount
        .where({ accountId: secondId })
        .forUpdate()
        .first();

    if(!firstRow || !secondRow) {
        throw new Error(`One or both accounts not found in database. Sender ID: ${senderID}, Recipient ID: ${recipientID}`);
    }

    return{
        senderBalance: Number(senderID === firstId ? firstRow.balance : secondRow.balance),
        recipientBalance: Number(recipientID === firstId ? firstRow.balance : secondRow.balance),
    }
}

export async function executeTransferTx(tx: TxClient,payload: TransferPayload) {
    const { senderId, recipientId, amount, idempotencyKey } = payload;
    if(senderId === recipientId) {
        throw new Error("Sender and recipient cannot be the same account.");
    }

    const txRecord = await tx.orm.public.Transaction
    .where({ idempotencyKey })
    .first();

    if(!txRecord) {
        throw new Error(`Transaction with idempotency key ${idempotencyKey} not found in database.`);
    }

    if(txRecord.executed) {
        console.log(`Transaction with idempotency key ${idempotencyKey} has already been executed.`);
        return {status:"DUPLICATE" as const, idempotencyKey};
    }

    const { senderBalance, recipientBalance } = await lookAccountInOrder(
        tx, 
        senderId, 
        recipientId
    );

    const numericAmount = Number(amount);
    if(senderBalance < numericAmount) {
        throw new Error(`Sender account with ID ${senderId} has insufficient balance.`);
    }

    const nextSenderBalance = (senderBalance - numericAmount).toFixed(2);
    const nextRecipientBalance = (recipientBalance + numericAmount).toFixed(2);

    await tx.orm.public.CheckingAccount
    .where({ accountId: senderId })
    .update({ balance: nextSenderBalance });

    await tx.orm.public.CheckingAccount
    .where({ accountId: recipientId })
    .update({ balance: nextRecipientBalance });

    await tx.orm.public.Transaction
    .where({ idempotencyKey })
    .update({ executed: true });

    console.log(`Transaction executed successfully: ID ${idempotencyKey}`);
    return {status:"EXECUTED" as const, idempotencyKey};
}

export async function runTransfer(payload: TransferPayload) {
    return db.transaction(async (tx) => {
        return executeTransferTx(tx, payload);
    }); 
}

async function releasingTransactionsFromDatabase() {
    const pendingTransactions = await db.orm.public.Transaction
    .where({ executed: false })
    .all();

    for(const transaction of pendingTransactions) {
        try {
            await runTransfer({
                id: transaction.id,
                senderId: transaction.senderId,
                recipientId: transaction.recipientId,
                amount: String(transaction.amount),
                idempotencyKey: transaction.idempotencyKey,
                executed: Boolean(transaction.executed)
            });
        } catch (error) {
            console.error(`Error occurred while processing transaction: ${transaction.idempotencyKey}`, error);
        }
    }
}

async function main() {
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
        throw new Error("DATABASE_URL is not configured");
    }

    await db.connect({ url: dbUrl });
    await insertAccountsOnDatabase(sampleAccountPayloads);
    await insertTransactionsOnDatabase(sampleTransactionPayloads);
    await releasingTransactionsFromDatabase();
}

const isMainModule =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
    main()
        .then(() => {
            console.log("All operations completed successfully.");
        })
        .catch((error) => {
            console.error("An error occurred:", error);
        }).finally(async () => {
            await db.close();
        });
}