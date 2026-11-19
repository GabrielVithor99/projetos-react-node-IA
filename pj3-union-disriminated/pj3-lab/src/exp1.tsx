interface ThermalReading{
    sensorId: string;
    celsius: number;
    active: boolean;
}

function isThermalReading(data: unknown) : data is ThermalReading{
    if(typeof data !== 'object' || data === null){
        return false;
    }

    if(!('sensorId' in data) || !('celsius' in data) || !('active' in data)){
        return false;
    }

    if(typeof data.sensorId !== 'string')return false;
    if(typeof data.celsius !== 'number' || Number.isNaN(data.celsius))return false;

    // TODO (Micro-desafio Parte 1):
  // Adicione abaixo a verificação para garantir que `data.active` seja um `boolean`!
  // Se não for boolean, retorne false.
    if(typeof data.active !== 'boolean') return false;

    return true;

}


function processRawPacktet(rawPacket: unknown){
    if(isThermalReading(rawPacket)){
        console.log(`[VÁLIDO] Leitura do sensor ${rawPacket.sensorId}: ${rawPacket.celsius}°C`);
    }else{
        console.log(`[REJEITADO] Pacote inválido: ${JSON.stringify(rawPacket)}`);
    }
}

const incomingPackets: unknown[] = [
    { sensorId: 'BLOCO-A1', celsius: 85.4, active: true },     // 1. Perfeito!
  null,                                                      // 2. Nulo!
  'erro de conexao',                                         // 3. String pura!
  { sensorId: 'BLOCO-B2', celsius: 'oitenta', active: true },// 4. Celsius veio como texto!
  { sensorId: 'BLOCO-C3', celsius: 40 },                     // 5. Faltando a chave `active`!
  { sensorId: 'BLOCO-D4', celsius: 92.1, active: 'sim' },
  { sensorId: 'BLOCO-D5', celsius: NaN, active: true },
]

for(const packet of incomingPackets){
    processRawPacktet(packet);
}