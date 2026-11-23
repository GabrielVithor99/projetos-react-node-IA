import {setTimeout as delay} from 'node:timers/promises';

let stock1 = 50; 
let stock2 = 50;
type DefferedComand<T> = () => Promise<T>;


class TaskManager{
private queue:Record <string, Array<() => void>> = {
    default: []
};
private activeTasks = 0;
private  maxTasks = 1;

constructor(){
};

public executeDeferredCommand<T>(command: DefferedComand<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const trigger = () => {
            this.activeTasks++;
            console.log(`[Task Started] Active tasks: ${this.activeTasks}/${this.maxTasks}`);
            Promise.resolve()
            .then(() => command())
            .finally(() => {
                this.activeTasks--;
                console.log(`[Task Finished] Active tasks: ${this.activeTasks}/${this.maxTasks}`);
                this.processNext();
            })
            .then(resolve)
            .catch(reject);
        };
        this.queue.default.push(trigger);
        this.processNext();
    });
};

    private getNextTrigger(): (() => void) | undefined {
        if(this.queue.default.length > 0){
            return this.queue.default.shift();
        }
        return undefined;
    }

    private processNext(): void {
        while(this.activeTasks < this.maxTasks){
            const nextTrigger = this.getNextTrigger();
            if(!nextTrigger) break;
            nextTrigger();
        }
    }
}

async function tryWithdrawUnsafe(orderId: number, amount:number):Promise<boolean>{
    const currentStock = stock1;
    await delay(100);
    if(currentStock < amount){
      console.log(`[PEDIDO] ${orderId} - Falha: Estoque insuficiente. (Estoque atual: ${currentStock}, Quantidade solicitada: ${amount})`);
        return false;    
    }

    stock1 = currentStock - amount;
    console.log(`[PEDIDO] ${orderId} - Sucesso: Estoque suficiente. (Estoque atual: ${currentStock}, Quantidade solicitada: ${amount})`);
    return true;
}
const taskManager = new TaskManager();

async function tryWithdrawSafe(orderId: number, amount:number):Promise<boolean>{ 
    return taskManager.executeDeferredCommand(async () => {
        const currentStock = stock2;
        console.log(`[PEDIDO] ${orderId} - Processando...`); 
        await delay(100);
    if(currentStock < amount){
       console.log(`[PEDIDO] ${orderId} - Falha: Estoque insuficiente. (Estoque atual: ${currentStock}, Quantidade solicitada: ${amount})`);
       return false;
    }
    stock2 = currentStock - amount;
    console.log(`[PEDIDO] ${orderId} - Sucesso: Estoque suficiente. (Estoque atual: ${currentStock}, Quantidade solicitada: ${amount})`);
    return true;
    });
}

async function runStressSimulation(){
    const orders = Array.from({length:20},(_,i) => tryWithdrawUnsafe(i+1, 10));
    const results = await Promise.all(orders);
    const approvedOrders = results.filter(r => r).length;

    console.log(`---Resultado da simulação de estresse---`);

    
    const ordersSafe = Array.from({length:20},(_,i) => tryWithdrawSafe(i+1, 10));
    const resultsSafe = await Promise.all(ordersSafe);
    const approvedOrdersSafe = resultsSafe.filter(r => r).length;
    
    
    console.log(`[TESTE DE CONCORRÊNCIA SEM GERENCIAMENTO DE TAREFAS]`);
    console.log(`Pedidos aprovados: ${approvedOrders} | Estoque final: ${stock1}`);
    console.log(`[TESTE DE CONCORRÊNCIA COM GERENCIAMENTO DE TAREFAS]`);
    console.log(`Pedidos aprovados (seguro): ${approvedOrdersSafe} | Estoque final: ${stock2}`);
}

runStressSimulation();