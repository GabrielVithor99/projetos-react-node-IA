interface ThermalAlert{
    kind:'THERMAL',
    sensorId: string;
    celsius: number;
}

interface PressureAlert{
    kind:'PRESSURE',
    valveId: string;
    psi: number;
    critical: boolean;
}

interface VibrationAlert{
    kind:'VIBRATION',
    motorId: string;
    hz: number;
}

type FactoryAlert = ThermalAlert | PressureAlert | VibrationAlert;

function handleAlert(alert: FactoryAlert):string{

    switch(alert.kind){
        case 'THERMAL':
            return `Alerta térmico do sensor ${alert.sensorId}: ${alert.celsius}°C`;
        case 'PRESSURE':
            return `Alerta de pressão da válvula ${alert.valveId}: ${alert.psi} PSI (Crítico: ${alert.critical})`;
        // TODO (Micro-desafio):
        // Adicione o `case 'VIBRATION':` abaixo retornando uma frase que mostre
        // o `alert.motorId` e o `alert.hertz`!
        case 'VIBRATION':
            return `Alerta de vibração do motor ${alert.motorId}: ${alert.hz} Hz`;
        ;
    }
}

const sampleAlerts: FactoryAlert[] = [
    { kind: 'THERMAL', sensorId: 'BLOCO-A1', celsius: 85.4 },
    { kind: 'PRESSURE', valveId: 'VALVULA-B2', psi: 120, critical: true },
    { kind: 'VIBRATION', motorId: 'MOTOR-C3', hz: 60 },
]

for(const alert of sampleAlerts){
    console.log(handleAlert(alert));
}