export interface Metrics {
  increment(name: string, labels?: Record<string, string>): void;
  observe(name: string, value: number, labels?: Record<string, string>): void;
}

export class InMemoryMetrics implements Metrics {
  private readonly counters = new Map<string, number>();

  increment(name: string, labels: Record<string, string> = {}): void {
    const key = `${name}:${JSON.stringify(labels)}`;
    this.counters.set(key, (this.counters.get(key) ?? 0) + 1);
  }

  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    this.counters.set(`${name}.last:${JSON.stringify(labels)}`, value);
  }

  snapshot(): Readonly<Record<string, number>> {
    return Object.fromEntries(this.counters);
  }
}
