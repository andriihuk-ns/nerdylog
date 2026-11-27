import { useId } from "react";
import "./animated-logo.css";
import { BRAND_ORANGE, LOG, NERDY, VIEW_H, VIEW_W } from "./nerdylog-logo";

/** Login wordmark: a light grey logo that fills with its colors from left to right. */
export function AnimatedLogo({ height = 40 }: { height?: number }) {
  const clipId = useId();
  return (
    <svg
      role="img"
      aria-label="nerdylog"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      height={height}
      width={(height * VIEW_W) / VIEW_H}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="login-logo"
    >
      <clipPath id={clipId}>
        <rect width={VIEW_W} height={VIEW_H} className="login-wipe" />
      </clipPath>
      {[...NERDY, ...LOG].map((d) => (
        <path key={d} d={d} className="login-ghost" />
      ))}
      <g clipPath={`url(#${clipId})`}>
        {NERDY.map((d) => (
          <path key={d} d={d} fill="currentColor" />
        ))}
        {LOG.map((d) => (
          <path key={d} d={d} fill={BRAND_ORANGE} />
        ))}
      </g>
    </svg>
  );
}
