export function cooldownParts(value) {
  const tenths = Math.min(9999, Math.max(0, Math.round((Number(value) || 0) * 10)));
  return { integer: Math.floor(tenths / 10), fraction: tenths % 10 };
}
export function changeCooldown(value, part, delta) {
  const parts = cooldownParts(value);
  if (part === "integer") parts.integer = Math.max(0, Math.min(999, parts.integer + delta));
  else parts.fraction = ((parts.fraction + delta) % 10 + 10) % 10;
  return `${parts.integer}.${parts.fraction}`;
}

export class CooldownPicker {
  constructor(root, onChange) {
    this.value = "4.0";
    this.onChange = onChange;
    this.columns = [...root.querySelectorAll(".cd-wheel")].map((column) => {
      const input = column.querySelector("input"), part = column.dataset.part;
      const max = part === "integer" ? 999 : 9;
      const step = (delta) => this.commit(changeCooldown(this.value, part, delta));
      input.addEventListener("input", () => {
        const digits = input.value.replace(/\D/g, "");
        if (!digits) return;
        const parts = cooldownParts(this.value);
        parts[part] = Math.min(max, Number(digits));
        this.commit(`${parts.integer}.${parts.fraction}`);
      });
      input.addEventListener("blur", () => this.setValue(this.value));
      input.addEventListener("keydown", (event) => {
        const delta = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 }[event.key];
        if (delta != null) { event.preventDefault(); step(delta); }
        else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          const parts = cooldownParts(this.value);
          parts[part] = event.key === "Home" ? 0 : max;
          this.commit(`${parts.integer}.${parts.fraction}`);
        }
      });
      let wheelDistance = 0;
      column.addEventListener("wheel", (event) => {
        event.preventDefault();
        wheelDistance += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
        const ticks = Math.trunc(wheelDistance / 35);
        if (ticks) { wheelDistance %= 35; step(Math.max(-10, Math.min(10, ticks))); }
      }, { passive: false });
      let drag = null;
      column.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        const editing = event.target === input;
        if (!editing) {
          event.preventDefault();
          input.focus({ preventScroll: true });
        }
        drag = { id: event.pointerId, y: event.clientY, startY: event.clientY,
          moved: false, editing };
        if (!editing) column.setPointerCapture(event.pointerId);
      });
      column.addEventListener("pointermove", (event) => {
        if (!drag || drag.id !== event.pointerId) return;
        if (Math.abs(event.clientY - drag.startY) > 8 && !drag.moved) {
          drag.moved = true;
          if (drag.editing) input.blur();
          column.setPointerCapture(event.pointerId);
        }
        const ticks = Math.trunc((drag.y - event.clientY) / 20);
        if (ticks) { step(ticks); drag.y -= ticks * 20; }
      });
      column.addEventListener("pointerup", (event) => {
        if (!drag || drag.id !== event.pointerId) return;
        drag = null;
      });
      column.addEventListener("pointercancel", () => { drag = null; });
      return { input, part };
    });
    this.setValue(this.value);
  }
  setValue(value) {
    this.value = value;
    const parts = cooldownParts(value);
    for (const { input, part } of this.columns) {
      const n = parts[part];
      input.value = String(n);
      input.setAttribute("aria-valuenow", n);
    }
  }
  commit(value) {
    this.setValue(value);
    this.onChange(value);
  }
}
