export type Tick = () => void;

export class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private readonly ticks: Tick[] = [];

  start(intervalMs: number): void {
    this.timer = setInterval(() => {
      for (const tick of this.ticks) tick();
    }, intervalMs);
  }

  subscribe(tick: Tick): void {
    this.ticks.push(tick);
  }

  isRunning(): boolean {
    return this.timer !== null;
  }
}
