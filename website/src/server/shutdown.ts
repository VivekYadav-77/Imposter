import type { Logger } from "pino";

export type CloseTask = () => Promise<void>;

export class ShutdownManager {
  private shuttingDown = false;

  constructor(
    private readonly logger: Logger,
    private readonly timeoutMs: number,
    private readonly tasks: readonly CloseTask[],
  ) {}

  async shutdown(reason: string): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    this.logger.info({ reason }, "Graceful shutdown started");

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Graceful shutdown timed out")), this.timeoutMs);
      timer.unref();
    });
    try {
      await Promise.race([Promise.all(this.tasks.map((task) => task())), timeout]);
      this.logger.info("Graceful shutdown completed");
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
