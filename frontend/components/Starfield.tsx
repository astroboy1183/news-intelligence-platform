"use client";

import { useEffect, useMemo, useState } from "react";

type Star = { x: number; y: number; size: number; opacity: number; delay: number; duration: number };

function generateStars(count: number, seed: number): Star[] {
  // tiny deterministic PRNG so stars stay put across renders.
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }, () => ({
    x: rand() * 100,
    y: rand() * 100,
    size: rand() * 1.6 + 0.4,
    opacity: rand() * 0.7 + 0.3,
    delay: rand() * 6,
    duration: rand() * 5 + 4,
  }));
}

export default function Starfield() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Three layers — small/medium/large — for depth.
  const layers = useMemo(
    () => [
      { count: 140, seed: 13, sizeMul: 0.6, opacity: 0.6 },
      { count: 60, seed: 47, sizeMul: 1.0, opacity: 0.8 },
      { count: 22, seed: 91, sizeMul: 1.6, opacity: 1.0 },
    ],
    [],
  );

  if (!mounted) return null; // avoid hydration mismatch

  return (
    <div className="starfield" aria-hidden>
      {/* Deep space base */}
      <div className="starfield-base" />

      {/* Animated nebula clouds */}
      <div className="nebula nebula-purple" />
      <div className="nebula nebula-cyan" />
      <div className="nebula nebula-pink" />

      {/* Star layers */}
      {layers.map((layer, layerIdx) => (
        <svg
          key={layerIdx}
          className="stars"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid slice"
          style={{ opacity: layer.opacity }}
        >
          {generateStars(layer.count, layer.seed).map((star, i) => (
            <circle
              key={i}
              cx={star.x * 10}
              cy={star.y * 10}
              r={star.size * layer.sizeMul}
              fill="white"
              style={{
                animation: `star-twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
                opacity: star.opacity,
              }}
            />
          ))}
        </svg>
      ))}

      {/* A handful of bright "feature" stars with extra glow */}
      <svg className="stars feature-stars" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
        {generateStars(8, 207).map((star, i) => (
          <circle
            key={i}
            cx={star.x * 10}
            cy={star.y * 10}
            r={star.size * 2.6}
            fill="white"
            style={{
              filter: "drop-shadow(0 0 4px rgba(255,255,255,0.9)) drop-shadow(0 0 14px rgba(165,243,252,0.5))",
              animation: `star-twinkle ${star.duration + 2}s ease-in-out ${star.delay}s infinite`,
            }}
          />
        ))}
      </svg>

      {/* Subtle grain to break up gradient banding */}
      <div className="starfield-grain" />
    </div>
  );
}
