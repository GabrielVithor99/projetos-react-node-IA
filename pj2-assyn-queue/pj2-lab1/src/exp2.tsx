import {setTimeout as delay} from 'node:timers/promises';
type DeferredTask<T> = () => Promise<T>;

class RadioTransmitter{
    private pendingTriggers: Array<() => void> = [];
    private activeCount = 0;
    private readonly maxChannels :number;

    constructor(maxChannels:number){
        this.maxChannels = maxChannels;
    };

    public transmit<T>(task: DeferredTask<T>): Promise<T>{
        return new Promise<T>((resolve,reject) =>{
            const  trigger = () => {
                this.activeCount++;
                console.log(`[Canal Ocupado] Ativos agora: ${this.activeCount}/${this.maxChannels}`);
                Promise.resolve()
                .then(() => task())
                .then(resolve)
                .catch(reject)
                .finally(() => {
                    this.activeCount--;
                    console.log(`[Canal Liberado] Ativos agora: ${this.activeCount}/${this.maxChannels}`);
                    this.processNext();
                });
            };

            this.pendingTriggers.push(trigger);
            this.processNext();
        });
    }

    private processNext(): void{
        if(this.activeCount < this.maxChannels && this.pendingTriggers.length >0){
            const nextTrigger = this.pendingTriggers.shift();
            if(nextTrigger){
                nextTrigger();
            }
        }
    };
}

async function runChannelTest(){
    const radio = new RadioTransmitter(2);
    const createPacket = (id: number, ms:number,shouldFail = false)=>{
        return radio
        .transmit(async () =>{
            console.log(` -> Iniciando tramissão do pacote ${id} (${ms}ms)`);
            await delay(ms);
            if(shouldFail){
                throw new Error(`Falha na transmissão do pacote ${id}`);
            }
            return `Pacote ${id} transmitido com sucesso`;
        })
        .then((res) => console.log(` -> Sucesso: ${res}`))
        .catch((err) => console.error(` -> Erro: ${err.message}`));
    };

    console.log("Disparando 5 pacotes simultaneamente (2 canais disponíveis):");
    await Promise.all([
    createPacket(1, 400, false),
    createPacket(2, 200, true), // Vai falhar aos 200ms e DEVE liberar o canal para o #3!
    createPacket(3, 300, false),
    createPacket(4, 100, false),
    createPacket(5, 200, false),
]);

    console.log("Todos os pacotes foram processados.");
}

runChannelTest();