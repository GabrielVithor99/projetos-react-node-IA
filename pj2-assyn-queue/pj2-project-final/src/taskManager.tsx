import {setTimeout as delay} from 'node:timers/promises';

type Priority = 'high' | 'medium' | 'low';
type DefferedComand<T> = () => Promise<T>;

class TaskManager{
    private queue:Record <Priority, Array<() => void>> = {
        'high': [],
        'medium': [],
        'low': []
    };
    private activeTasks = 0;
    private readonly maxTasks: number;
    private peakActiveTasks = 0;

    constructor(maxTasks: number){
        this.maxTasks = maxTasks;
    }

    public addTask<T>(priority: Priority, task: DefferedComand<T>): Promise<T>{
        return new Promise<T>((resolve, reject) => {
            const trigger = () => {
                this.activeTasks++;
                if(this.activeTasks > this.peakActiveTasks){
                    this.peakActiveTasks = this.activeTasks;
                }
                console.log(`[Task Started] Active tasks: ${this.activeTasks}/${this.maxTasks}`);
                Promise.resolve()
                .then(() => task())
                .finally(() => {
                    this.activeTasks--;
                    console.log(`[Task Finished] Active tasks: ${this.activeTasks}/${this.maxTasks}`);
                    this.processNext();
                })
                .then(resolve)
                .catch(reject)
            };
            this.queue[priority].push(trigger);
            this.processNext();
        });
    }

    private getNextTrigger(): (() => void) | undefined{
        if(this.queue.high.length > 0){
            return this.queue.high.shift();
        }
        if(this.queue.medium.length > 0){
            return this.queue.medium.shift();
        }
        if(this.queue.low.length > 0){
            return this.queue.low.shift();
        }
        return undefined;
    }

    private processNext() :void{
        while(this.activeTasks < this.maxTasks){
            const nextTrigger = this.getNextTrigger();
            if(!nextTrigger) break;
            nextTrigger();
        }
    }

    public getStats(){
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        return {
            activeTasks: this.activeTasks,
            peakActiveTasks: this.peakActiveTasks,
            maxTasks: this.maxTasks,
            memoryUsage: `${memoryUsage} MB`
        };
}
}

async function runTaskManager(){
    const taskManager = new TaskManager(10);
    const registerTask = (priority: Priority, taskName: string, duration: number, shouldFail = false) => {
        return taskManager.addTask(priority, async () => {
            console.log(`Task ${taskName} started with priority ${priority} - duration ${duration}ms`);
            await delay(duration);
            if(shouldFail){
                throw new Error(`Task ${taskName} failed`);
            }
            return `Task ${taskName} completed`;
        });
    };

    console.log("Enfileirando tarefas...");
    const priorities: Priority[] = ['high', 'medium', 'low'];
    
    function getRandomPriority(): Priority {
        const randomIndex = Math.floor(Math.random() * priorities.length);
        return priorities[randomIndex];
    }

    function getRandomDuration(): number {
        return Math.floor(Math.random() * 25) + 5; // Random duration between 5ms and 30ms
    }

   function failRandomly(): boolean {
        return Math.random() < 0.3; // 30% chance to fail
    }
    
    function tasksExecuted<T>(result: PromiseSettledResult<T>[]): void {
        let fulfilledCount = 0;
        let rejectedCount = 0;

        for (const res of result) {
            if (res.status === 'fulfilled') {
                fulfilledCount++;
            } else {
                rejectedCount++;
            }
        }
        console.log(`Tasks executed: ${fulfilledCount} fulfilled, ${rejectedCount} rejected`);
    }

    const scheduledTasks: Promise<string>[] = [];

    for (let i = 0; i < 1000; i++) {
        const priority = getRandomPriority();
        const duration = getRandomDuration();
        const shouldFail = failRandomly();
        scheduledTasks.push(registerTask(priority, `Task-${i}`, duration, shouldFail));
    }
    
    console.log(`All tasks have been enqueued.`);
    console.log(`Waiting for all tasks to complete...`);
    const allTasks = await Promise.allSettled(scheduledTasks);

    tasksExecuted(allTasks);
    console.log(`All tasks have been processed.`);
    console.log(`Task Manager Stats:`, taskManager.getStats());
}

runTaskManager();