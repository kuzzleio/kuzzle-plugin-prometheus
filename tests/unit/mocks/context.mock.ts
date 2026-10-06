import { vi } from "vitest";

export class ContextMock {
  accessors: any;
  errors: any;
  constructors: any;
  log: any;
  errorsManager: any;
  config: any;
  kerror: any;
  secrets: any;

  constructor() {
    this.log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    this.accessors = {
      nodeId: "kuzzle-node-id",
      sdk: {
        query: vi.fn(),
      },
    };
  }
}
