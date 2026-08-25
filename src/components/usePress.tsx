import { useMemo, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { markUiPointer } from "@/game/input";

const TAP_GUARD_MS = 280;

export function usePress(action: () => void) {
  const last = useRef(0);
  const act = useRef(action);
  act.current = action;

  return useMemo(
    () => ({
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        markUiPointer(e.pointerId);
        e.stopPropagation();
        const now = performance.now();
        if (now - last.current < TAP_GUARD_MS) return;
        last.current = now;
        act.current();
      },
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        const now = performance.now();
        if (now - last.current < TAP_GUARD_MS) return;
        last.current = now;
        act.current();
      },
    }),
    [],
  );
}

type UiButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "onPointerDown"> & {
  onPress: () => void;
  pressed?: boolean;
  children: ReactNode;
};

export function UiButton({ onPress, pressed, className, children, ...rest }: UiButtonProps) {
  const press = usePress(onPress);
  return (
    <button type="button" data-ui="btn" aria-pressed={pressed} className={className} {...rest} {...press}>
      {children}
    </button>
  );
}
