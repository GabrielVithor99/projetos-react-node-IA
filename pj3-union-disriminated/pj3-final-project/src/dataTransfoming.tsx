interface HTTP{
    kind: 'HTTP',
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
}

interface Payment{
    kind: 'Payment',
    amount: number,
    currency: string,
}

interface Security{
    kind: 'Security',
    level: 'low' | 'medium' | 'high',
}

function assertNever(data: never): never{
    throw new Error(`Unexpected data: ${JSON.stringify(data)}`);
}

function isObjectOrNull(data: unknown): data is object | null{
    return typeof data === 'object' || data === null;
}
function isHTTP(data: unknown): data is HTTP{
    if(typeof data.url !== 'string') return false;
    if(!['GET', 'POST', 'PUT', 'DELETE'].includes(data.method)) return false;
    return 'url' in data && 'method' in data;
    
}
function isPayment(data: unknown): data is Payment{
       if(typeof data.amount !== 'number' || Number.isNaN(data.amount)) return false;
        if(typeof data.currency !== 'string') return false;
        return 'amount' in data && 'currency' in data;
}

function isSecurity(data: unknown): data is Security{
    if(!['low', 'medium', 'high'].includes(data.level)) return false;
    return 'level' in data;
}

function kindValidator(data: unknown): unknown is HTTP | Payment | Security {
    
    if(!isObjectOrNull(data)){
        return false;
    }
    if('kind' in data){
        switch(data.kind){
            case 'HTTP':
                return isHTTP(data);
            case 'Payment':
                return isPayment(data);
            case 'Security':
                return isSecurity(data);
            default:
                return assertNever(data);
        }
    }
}

const incomingData: unknown[] = [
    { kind: 'HTTP', url: 'https://api.example.com', method: 'GET' },
    { kind: 'Payment', amount: 100, currency: 'USD' },
    { kind: 'Security', level: 'medium' },
    { kind: 'HTTP', url: 'https://api.example.com', method: 'PATCH' }, // Invalid method
    { kind: 'Payment', amount: NaN, currency: 'USD' }, // Invalid amount
    { kind: 'Security', level: 'extreme' }, // Invalid level
    { kind: 'Unknown', data: 'test' }, // Unknown kind
];

for(const data of incomingData){
    if(kindValidator(data)){
        console.log(`[VÁLIDO] Dados recebidos: ${JSON.stringify(data)}`);
    }else{
        console.log(`[REJEITADO] Dados inválidos: ${JSON.stringify(data)}`);
    }
}