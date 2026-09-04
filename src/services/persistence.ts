import { loadState, saveState, type SavedState } from "./storage";

export class PersistenceService {
  private timer: number | null = null;

  constructor(
    private readonly getState: () => SavedState,
    private readonly onError: () => void,
  ) {}

  load(): Promise<SavedState> {
    return loadState();
  }

  save(): Promise<void> {
    return saveState(this.getState());
  }

  schedule(delayMs = 600): void {
    if (this.timer !== null) return;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.save().catch(this.onError);
    }, delayMs);
  }
}
