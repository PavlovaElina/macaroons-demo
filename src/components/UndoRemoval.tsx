import type { CartLine } from "../types";
export type RemovedItem = {
  token: string;
  line: CartLine;
  index: number;
  expiresAt: number;
};
export function UndoRemoval({
  items,
  onUndo,
  name,
  floating = false,
  error,
}: {
  items: RemovedItem[];
  onUndo: (item: RemovedItem) => void;
  name: (line: CartLine) => string;
  floating?: boolean;
  error?: string;
}) {
  if (!items.length) return null;
  return (
    <div
      className={floating ? "undo-stack floating" : "undo-stack"}
      aria-label="Удалённые товары"
      role="region"
    >
      {error && (
        <p className="undo-error" role="alert">
          {error}
        </p>
      )}
      {items.map((item) => (
        <div key={item.token} className="undo-item">
          <p role="status">
            Удалено: {name(item.line)} × {item.line.quantity}
          </p>
          <button
            type="button"
            onClick={() => onUndo(item)}
            aria-label={`Вернуть: ${name(item.line)}`}
          >
            Вернуть
          </button>
        </div>
      ))}
    </div>
  );
}
