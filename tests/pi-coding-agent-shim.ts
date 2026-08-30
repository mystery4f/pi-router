export function getAgentDir(): string {
  return process.env.PI_CODING_AGENT_DIR || `${process.env.HOME || process.cwd()}/.pi/agent`;
}

export class DynamicBorder {
  private readonly color: (str: string) => string;

  constructor(color: (str: string) => string = (str) => str) {
    this.color = color;
  }

  invalidate(): void {}

  render(width: number): string[] {
    return [this.color("─".repeat(Math.max(1, width)))];
  }
}
