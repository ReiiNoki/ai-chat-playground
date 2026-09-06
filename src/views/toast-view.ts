import { t } from "../lib/i18n";
import { toastRegion } from "./elements";

export type ToastTone = "success" | "error" | "info";

export class ToastView {
  show(message: string, tone: ToastTone = "info"): void {
    const toast = document.createElement("div");
    toast.className = `toast toast-${tone}`;
    toast.textContent = t(message);
    toastRegion.append(toast);

    window.setTimeout(() => {
      toast.classList.add("is-leaving");
      toast.addEventListener("animationend", () => toast.remove(), { once: true });
      window.setTimeout(() => toast.remove(), 250);
    }, 2200);
  }
}
