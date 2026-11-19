interface ThermalReading{
    kind: 'THERMAL',
    sensorId: string;
    celsius: number;
}

interface PressureReading{
    kind: 'PRESSURE',
    valveId: string;
    psi: number;
    critical: boolean;
}

interface VibrationReading{
    kind: 'VIBRATION',
    motorId: string;
    hz: number;
}

interface SmokeAlert{
    kind: 'SMOKE',
    sector: string,
    densityPercent: number
}

type FactoryReading = ThermalReading | PressureReading | VibrationReading | SmokeAlert;

function assertNever(value : never): never{
    throw new Error(`Tipo inesperado: ${JSON.stringify(value)}`);
}

function handleAlert(alert: FactoryReading):string{

    switch(alert.kind){
        case 'THERMAL':
            return `Leitura térmica do sensor ${alert.sensorId}: ${alert.celsius}°C`;
        case 'PRESSURE':
            return `Leitura de pressão da válvula ${alert.valveId}: ${alert.psi} PSI (Crítico: ${alert.critical})`;
        case 'VIBRATION':
            return `Leitura de vibração do motor ${alert.motorId}: ${alert.hz} Hz`;
        // TODO (Micro-desafio):
    // 1. Primeiro, deixe sem o `case 'SMOKE':` e olhe o erro que o TypeScript dá na linha do `default` abaixo!
    // 2. Depois, adicione o `case 'SMOKE':` antes do `default` para consertar a compilação!
        case 'SMOKE':
            return `Alerta de fumaça no setor ${alert.sector}: ${alert.densityPercent}% de densidade`;
        default:
            return assertNever(alert);
    }
}

const sampleAlerts: FactoryReading[] = [
    { kind: 'THERMAL', sensorId: 'BLOCO-A1', celsius: 85.4 },
    { kind: 'PRESSURE', valveId: 'VALVULA-B2', psi: 120, critical: true },
    { kind: 'VIBRATION', motorId: 'MOTOR-C3', hz: 60 },
    { kind: 'SMOKE', sector: 'SETOR-D4', densityPercent: 75 },
    { kind: 'UNKNOWN', data: 'some data'}
]

for(const alert of sampleAlerts){
    console.log(handleAlert(alert));
}