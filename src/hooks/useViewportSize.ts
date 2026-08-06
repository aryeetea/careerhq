import * as React from "react";

export interface ViewportSize {
  width: number;
  height: number;
}

/** Live window dimensions — used by the tour to keep the spotlight mask and
 * card positioning correct across resizes and orientation changes. */
export function useViewportSize(): ViewportSize {
  const [size, setSize] = React.useState<ViewportSize>(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  React.useEffect(() => {
    function onResize() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}
