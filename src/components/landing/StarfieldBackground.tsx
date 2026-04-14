'use client';

import React, { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkle: number;
}

function generateStars(
  count: number,
  sizeMin: number,
  sizeMax: number,
  opacityMin: number,
  opacityMax: number
): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: sizeMin + Math.random() * (sizeMax - sizeMin),
      opacity: opacityMin + Math.random() * (opacityMax - opacityMin),
      twinkle: 2 + Math.random() * 5,
    });
  }
  return stars;
}

const LAYER_1 = generateStars(200, 0.5, 1.2, 0.3, 0.7);
const LAYER_2 = generateStars(80, 1.2, 2.5, 0.4, 0.8);
const LAYER_3 = generateStars(15, 3, 6, 0.15, 0.35);

const fill: React.CSSProperties = { position: 'absolute', inset: 0 };
const layerWrap: React.CSSProperties = { ...fill, willChange: 'transform' };
const rootStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
  zIndex: 0,
};

export default function StarfieldBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          if (!containerRef.current) return;
          const scrollY = window.scrollY;
          const layers = containerRef.current.children;
          if (layers[0]) (layers[0] as HTMLElement).style.transform = `translateY(${scrollY * 0.03}px)`;
          if (layers[1]) (layers[1] as HTMLElement).style.transform = `translateY(${scrollY * 0.07}px)`;
          if (layers[2]) (layers[2] as HTMLElement).style.transform = `translateY(${scrollY * 0.12}px)`;
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div ref={containerRef} style={rootStyle}>
      <div style={layerWrap}>
        {LAYER_1.map((s, i) => (
          <div
            key={`l1-${i}`}
            style={{
              position: 'absolute',
              borderRadius: '50%',
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              background: '#fff',
              opacity: s.opacity,
              animation: `tz-twinkle ${s.twinkle}s ease-in-out infinite alternate`,
              animationDelay: `${(i * 0.07) % 5}s`,
            }}
          />
        ))}
      </div>

      <div style={layerWrap}>
        {LAYER_2.map((s, i) => (
          <div
            key={`l2-${i}`}
            style={{
              position: 'absolute',
              borderRadius: '50%',
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              background: '#fff',
              opacity: s.opacity,
              boxShadow: `0 0 ${s.size * 2}px rgba(255,255,255,0.3)`,
              animation: `tz-twinkle ${s.twinkle}s ease-in-out infinite alternate`,
              animationDelay: `${(i * 0.11) % 5}s`,
            }}
          />
        ))}
      </div>

      <div style={layerWrap}>
        {LAYER_3.map((s, i) => (
          <div
            key={`l3-${i}`}
            style={{
              position: 'absolute',
              borderRadius: '50%',
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              background:
                i % 3 === 0
                  ? 'rgba(59,130,246,0.5)'
                  : i % 3 === 1
                  ? 'rgba(139,92,246,0.4)'
                  : 'rgba(255,255,255,0.3)',
              boxShadow: `0 0 ${s.size * 6}px ${
                i % 3 === 0 ? 'rgba(59,130,246,0.3)' : 'rgba(139,92,246,0.2)'
              }`,
              animation: `tz-twinkle ${s.twinkle + 2}s ease-in-out infinite alternate`,
              animationDelay: `${(i * 0.19) % 5}s`,
            }}
          />
        ))}
      </div>

      <div
        style={{
          ...fill,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.04) 0%, transparent 70%)',
        }}
      />

      <style>{`
        @keyframes tz-twinkle {
          0% { opacity: 0.2; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
