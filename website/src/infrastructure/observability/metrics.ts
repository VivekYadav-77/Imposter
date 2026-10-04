export interface Metrics {
  increment(name: string, labels?: Record<string, string>): void;
  observe(name: string, value: number, labels?: Record<string, string>): void;
  set(name: string, value: number, labels?: Record<string, string>): void;
  renderPrometheus(): string;
}

export class InMemoryMetrics implements Metrics {
  private readonly values = new Map<
    string,
    { name: string; labels: Record<string, string>; value: number }
  >();

  private key(name: string, labels: Record<string, string>): string {
    return `${name}:${JSON.stringify(Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)))}`;
  }

  increment(name: string, labels: Record<string, string> = {}): void {
    const metricName = `${name}.total`;
    const key = this.key(metricName, labels);
    const current = this.values.get(key)?.value ?? 0;
    this.values.set(key, { name: metricName, labels: { ...labels }, value: current + 1 });
  }

  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    this.set(`${name}.last`, value, labels);
    this.increment(`${name}.observations`, labels);
  }

  set(name: string, value: number, labels: Record<string, string> = {}): void {
    this.values.set(this.key(name, labels), { name, labels: { ...labels }, value });
  }

  snapshot(): Readonly<Record<string, number>> {
    return Object.fromEntries([...this.values].map(([key, metric]) => [key, metric.value]));
  }

  renderPrometheus(): string {
    const lines = [...this.values.values()]
      .sort((a, b) => this.key(a.name, a.labels).localeCompare(this.key(b.name, b.labels)))
      .map(({ name, labels, value }) => {
        const metricName = `imposter_game_${name.replace(/[^a-zA-Z0-9_:]/g, "_")}`;
        const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
        const serialized = entries.length
          ? `{${entries
              .map(
                ([key, label]) =>
                  `${key.replace(/[^a-zA-Z0-9_]/g, "_")}="${label.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"')}"`,
              )
              .join(",")}}`
          : "";
        return `${metricName}${serialized} ${Number.isFinite(value) ? value : 0}`;
      });
    return `${lines.join("\n")}\n`;
  }
}
