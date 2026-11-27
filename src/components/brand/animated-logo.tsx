import { useId, type CSSProperties } from "react";
import "./animated-logo.css";
import { BRAND_ORANGE, LOG, NERDY, VIEW_H, VIEW_W } from "./nerdylog-logo";

type Letter = {
  name: string;
  shape: string;
  fill: string;
  /** Pen strokes that reveal the shape, drawn in handwriting direction. */
  strokes: string[];
};

const INK = "currentColor";

/** Left to right, so the index doubles as the stagger order. */
const LETTERS: Letter[] = [
  { name: "n", shape: NERDY[4]!, fill: INK, strokes: ["M4.7 33V6V14C8 10.5 25.9 8 25.9 20V33"] },
  {
    name: "e",
    shape: NERDY[3]!,
    fill: INK,
    strokes: ["M37 19.3H58C59 8.5 38 8.5 38 19.6C38 30.5 55 30 64 22.5"],
  },
  { name: "r", shape: NERDY[2]!, fill: INK, strokes: ["M71 33V6V16C73 11.5 79 11.8 88 11.8"] },
  {
    name: "d",
    shape: NERDY[1]!,
    fill: INK,
    strokes: ["M111 14C104 8.5 91.5 10 91.5 19.6C91.5 29.5 106 31 113.3 26V-2"],
  },
  { name: "y", shape: NERDY[0]!, fill: INK, strokes: ["M124 6L136.5 31", "M149.5 6L134 43"] },
  { name: "l", shape: LOG[2]!, fill: BRAND_ORANGE, strokes: ["M159.6 -1V33"] },
  {
    name: "o",
    shape: LOG[1]!,
    fill: BRAND_ORANGE,
    strokes: ["M182.4 11.4C167.5 11.4 167.5 27.8 182.4 27.8C197.3 27.8 197.3 11.4 180 11.4"],
  },
  {
    name: "g",
    shape: LOG[0]!,
    fill: BRAND_ORANGE,
    strokes: [
      "M222 13C215 8.5 204.5 10 204.5 18.8C204.5 28 219 28 226.3 21V6V28C226.3 37 213 38 200 33.5",
    ],
  },
];

/** Login wordmark: a light grey logo that each letter fills in, then settles with a small bounce. */
export function AnimatedLogo({ height = 40 }: { height?: number }) {
  const id = useId();
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
      {LETTERS.map((letter, index) => {
        const maskId = `${id}${letter.name}`;
        return (
          <g key={letter.name} className="login-letter" style={{ "--i": index } as CSSProperties}>
            <mask id={maskId} maskUnits="userSpaceOnUse" x={-10} y={-10} width={251} height={60}>
              {letter.strokes.map((d) => (
                <path key={d} d={d} pathLength={1} className="login-pen" />
              ))}
              {/* Guarantees full coverage once the strokes have been drawn. */}
              <rect x={-10} y={-10} width={251} height={60} fill="white" className="login-settle" />
            </mask>
            <path d={letter.shape} className="login-ghost" />
            <path d={letter.shape} fill={letter.fill} mask={`url(#${maskId})`} />
          </g>
        );
      })}
    </svg>
  );
}
