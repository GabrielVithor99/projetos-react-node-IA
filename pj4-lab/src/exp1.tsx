import {z} from "zod";

const withdawSchema = z.object({
    itemCode: z.string().trim().min(1),
    quantity: z.number().int().positive().max(100),
    stationId:z.string().trim().min(1),
});

function inspectWithdrawPacket(rawInput: unknown){
    const parsed = withdawSchema.safeParse(rawInput);

    if(!parsed.success){
        console.error("Invalid withdraw packet:", parsed.error.flatten().fieldErrors);
        return;
    }

    console.log("Valid withdraw packet:", parsed.data);
}

const samplePayloads: unknown[] = [
  { itemCode: 'PARAFUSO-M6', quantity: 15, stationId: 'BANCADA-02' }, // Válido
  { itemCode: 'PARAFUSO-M6', quantity: -5, stationId: 'BANCADA-02' }, // Quantidade negativa
  { itemCode: 'PARAFUSO-M6', quantity: 2.5, stationId: 'BANCADA-02' }, // Decimal (não inteiro)
  { itemCode: '', quantity: 10, stationId: 'BANCADA-02' },           // Código vazio
  { itemCode: 'PARAFUSO-M6', quantity: 0, stationId: 'BANCADA-05' },           // Código vazio
  { itemCode: 'PARAFUSO-M6', quantity: 150, stationId: 'BANCADA-04' },           // Código vazio
  null,                                                               // Nulo
];

for(const payload of samplePayloads){
    inspectWithdrawPacket(payload);
}