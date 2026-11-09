import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const prior = document.activeElement as HTMLElement;
    el.showModal();
    el.querySelector<HTMLElement>("#dialog-title")?.focus({
      preventScroll: true,
    });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = overflow;
      prior?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "dialog wide" : "dialog"}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <header className="dialog-header">
        <h2 id="dialog-title" tabIndex={-1}>
          {title}
        </h2>
        <button
          className="icon-button"
          aria-label="Закрыть окно"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Quantity({
  value,
  onChange,
  max = 99,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
  label: string;
}) {
  return (
    <div className="quantity">
      <button
        type="button"
        aria-label={`Уменьшить: ${label}`}
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
      >
        <Icon name="minus" />
      </button>
      <span aria-label={`${label}: ${value}`}>{value}</span>
      <button
        type="button"
        aria-label={`Увеличить: ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
}
