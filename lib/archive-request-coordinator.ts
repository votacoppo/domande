export type CoordinatedRequest = {
  signal: AbortSignal;
  isCurrent: () => boolean;
};

export class ArchiveRequestCoordinator {
  private sequence = 0;
  private controller: AbortController | null = null;

  begin(): CoordinatedRequest {
    this.controller?.abort();
    const requestId = ++this.sequence;
    const controller = new AbortController();
    this.controller = controller;
    return {
      signal: controller.signal,
      isCurrent: () => this.sequence === requestId && !controller.signal.aborted,
    };
  }

  cancel(): void {
    this.sequence += 1;
    this.controller?.abort();
    this.controller = null;
  }
}
