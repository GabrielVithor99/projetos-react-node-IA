import {setTimeout as delay} from 'node:timers/promises';

type Priority = 'high' | 'medium' | 'low';
type DefferedComand<T> = () => Promise<T>;

class EmergencyTriage{
    private queues: Record<Priority, Array<() => void>> = {
        high: [],
        medium: [],
        low: []
    };
private activeDoctors = 0;
private readonly maxDoctors: number;

constructor(maxDoctors: number){
    this.maxDoctors = maxDoctors;
}

public attend<T>(priority: Priority, task: DefferedComand<T>):Promise<T>{
    return new Promise<T>((resolve,reject) =>{
        const trigger = () => {
            this.activeDoctors++;
            Promise.resolve()
            .then(() => task())
            .then(resolve)
            .catch(reject)
            .finally(() => {
                this.activeDoctors--;
                this.processNext();
            });
        }
        // TODO 1: Empurrar o `trigger` para a subfila correta usando o parâmetro `priority`
        this.queues[priority].push(trigger);
        this.processNext();
    });
};

private getNextTrigger(): (() => void) | undefined{
    // TODO 2: Inspecionar as filas na ordem estrita ('high', depois 'medium', depois 'low').
    // Retornar o .shift() da primeira fila que possuir elementos!
    if(this.queues.high.length > 0){
        return this.queues.high.shift();
    }
    if(this.queues.medium.length > 0){
        return this.queues.medium.shift();
    }
    if(this.queues.low.length > 0){
        return this.queues.low.shift();
    }
    return undefined;

};

private processNext() :void{
    while(this.activeDoctors < this.maxDoctors){
        const nextTrigger = this.getNextTrigger();
        if(!nextTrigger) break;
        nextTrigger();
    }
}
}

async function runTriageTest(){
    const triage = new EmergencyTriage(1);
    const registerPatient = (name:string, priority: Priority, ms:number, shouldFail = false) =>{
        return triage.attend(priority, async () =>{
            console.log(` -> Atendendo paciente ${name} (prioridade: ${priority}, ${ms}ms)`);
            await delay(ms);
            if(shouldFail){
                throw new Error(`Erro ao atender paciente ${name}`);
            }
            return `Paciente ${name} atendido com sucesso`;
        });
    };

    console.log("Enfileirando pacientes com diferentes prioridades (1 médico disponível):");
    const results = await Promise.allSettled([
    registerPatient('Paciente 1 (Baixa)', 'low', 200, false),
    registerPatient('Paciente 2 (Baixa)', 'low', 100, false),
    registerPatient('Paciente 3 (Média)', 'medium', 100, true), // Falha intencional
    registerPatient('Paciente 4 (ALTA)', 'high', 100, false),
    ]);
    
    console.log("\nRelatório final consolidado: (Promise.allSettled)");
    console.log(results);
}

runTriageTest();