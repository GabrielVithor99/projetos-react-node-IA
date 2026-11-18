import {setTimeout as delay} from 'node:timers/promises';

type DefferedComand<T> = () => Promise<T>;

class PrintSpooler{
    private pendingTriggers: Array<() => void> = [];

    public schedule<T>(command: DefferedComand<T>):Promise<T>{
        return new Promise<T>((resolve,reject) =>{
            const trigger = () =>{
                Promise.resolve().then(() => command()).then(resolve).catch(reject);                    
            };
        this.pendingTriggers.push(trigger);
        });
    }

    public releaseNext():boolean{
        const nextTrigger = this.pendingTriggers.shift();
        if(!nextTrigger) return false;
        
        nextTrigger();
        return true;
        }
    }

async function runSandBox(){
    const spooler = new PrintSpooler();


    try{
        console.log("[Normal command execution]\n");
        console.log("1. Scheduling command...");
        const jobPromise = spooler.schedule(async () => {
        console.log("-> Excuting command internally...");
        await delay(300);
        return {pagesPrinted: 42, status:'OK'};
        });
        console.log("2. Command scheduled, waiting for release...");
    
        await delay(500);

        console.log("3.Triggring release manually...");
        spooler.releaseNext();

        const result = await jobPromise;
        console.log("4. Command finished with result:", result);
    }catch(err){
        console.error("-> Error executing command:", (err as Error).message);
    }
    
    try{
        console.log("[Error command execution]\n");
        console.log("1. Scheduling command...");
        const jobPromise = spooler.schedule(async () => {
        console.log("-> Excuting command internally...");
        await delay(300);
        throw new Error("Printer jammed");
        });
        console.log("2. Command scheduled, waiting for release...");
    
        await delay(500);

        console.log("3.Triggring release manually...");
        spooler.releaseNext();

        const result = await jobPromise;
        console.log("4. Command finished with result:", result);
    }catch(err){
        console.error("-> Error executing command:", (err as Error).message);
    }
    
    
}

runSandBox();
