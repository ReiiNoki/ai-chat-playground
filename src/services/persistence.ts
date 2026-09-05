import { loadState, saveState, type SavedState } from "./storage";

export class PersistenceService {
  private timer: number | null = null;
  private suspended = 0;
  private savePending = false;

  constructor(
    private readonly getState: () => SavedState,
    private readonly onError: () => void,
  ) {}

  load(): Promise<SavedState> {
    return loadState();
  }

  save(): Promise<void> {
    if (this.suspended > 0) {
      this.savePending = true;
      return Promise.resolve();
    }
    return saveState(this.getState());
  }

  suspend(): void {
    this.suspended += 1;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
      this.savePending = true;
    }
  }

  resume(): void {
    this.suspended = Math.max(0, this.suspended - 1);
    if (this.suspended === 0 && this.savePending) {
      this.savePending = false;
      void this.save().catch(this.onError);
    }
  }

  schedule(delayMs = 600): void {
    if (this.suspended > 0) {
      this.savePending = true;
      return;
    }
    if (this.timer !== null) return;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.save().catch(this.onError);
    }, delayMs);
  }
}
