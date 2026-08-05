import * as React from "react";
import { cn } from "@/lib/utils";

export interface AutoResizeTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> {
  value: string;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  error?: boolean;
  minRows?: number;
  maxHeight?: number;
}

export const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ className, value, onChange, error = false, minRows = 1, maxHeight = 168, style, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef]
    );

    const resize = React.useCallback(() => {
      const element = innerRef.current;
      if (!element) return;

      element.style.height = "auto";
      const computed = window.getComputedStyle(element);
      const lineHeight = Number.parseFloat(computed.lineHeight) || 20;
      const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
      const paddingBottom = Number.parseFloat(computed.paddingBottom) || 0;
      const borderTop = Number.parseFloat(computed.borderTopWidth) || 0;
      const borderBottom = Number.parseFloat(computed.borderBottomWidth) || 0;
      const minHeight = Math.ceil(lineHeight * minRows + paddingTop + paddingBottom + borderTop + borderBottom);
      const nextHeight = Math.min(Math.max(element.scrollHeight, minHeight), maxHeight);

      element.style.height = `${nextHeight}px`;
      element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
    }, [maxHeight, minRows]);

    React.useLayoutEffect(() => {
      resize();
    }, [resize, value]);

    React.useEffect(() => {
      const handleResize = () => resize();
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, [resize]);

    return (
      <textarea
        {...props}
        ref={setRefs}
        value={value}
        onChange={onChange}
        rows={minRows}
        aria-invalid={error || props["aria-invalid"]}
        className={cn(
          "flex w-full resize-none rounded-2xl border border-input/90 bg-card/95 px-3.5 py-2.5 text-sm leading-6 shadow-soft transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-muted/45 disabled:opacity-65 aria-[invalid=true]:border-destructive/60 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/15 motion-reduce:transition-none",
          className
        )}
        style={{ ...style, maxHeight }}
      />
    );
  }
);

AutoResizeTextarea.displayName = "AutoResizeTextarea";
