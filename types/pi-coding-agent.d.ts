declare module "@earendil-works/pi-coding-agent" {
  /** Runtime implementation is supplied by the Pi host extension loader. */
  export function getAgentDir(): string;

  /** The extension API is supplied by the running Pi host. */
  export type ExtensionAPI = any;

  /** Runtime implementation is supplied by the Pi host extension loader. */
  export class DynamicBorder {
    constructor(color?: (str: string) => string);
    invalidate(): void;
    render(width: number): string[];
  }
}
