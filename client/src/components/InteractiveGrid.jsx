import { useRef } from 'react';
import { motion, useMotionValue, useTransform, useMotionTemplate, useAnimationFrame } from 'framer-motion';

/**
 * Animated infinite-scroll grid that brightens around the cursor.
 *
 * Three stacked layers:
 *  1. faint ambient grid (always visible, slowly scrolling)
 *  2. bright grid revealed only inside a radial mask that follows the cursor
 *  3. ambient gradient blobs (NTG accent + ember + steel) blurred behind it all
 *
 * The component is a full-bleed absolute backdrop. Drop it as the first child of
 * any positioned container and stack the page content above it with `relative z-10`.
 *
 * Props
 *  - density: pixel spacing between grid lines (default 44)
 *  - revealRadius: spotlight radius in px (default 320)
 *  - blobIntensity: 'subtle' | 'normal' | 'wild' — how loud the blurred gradients are
 *  - showSpotlight: turn the cursor reveal on/off (default true)
 */
export default function InteractiveGrid({
  density = 44,
  revealRadius = 320,
  blobIntensity = 'normal',
  showSpotlight = true,
  className = '',
}) {
  const wrapRef = useRef(null);
  const mouseX = useMotionValue(-9999);
  const mouseY = useMotionValue(-9999);

  const onMove = (e) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };
  const onLeave = () => {
    mouseX.set(-9999);
    mouseY.set(-9999);
  };

  // Slow infinite scroll. Different speeds for X/Y so it feels parallaxy.
  const offsetX = useMotionValue(0);
  const offsetY = useMotionValue(0);
  useAnimationFrame(() => {
    offsetX.set((offsetX.get() + 0.18) % density);
    offsetY.set((offsetY.get() + 0.12) % density);
  });

  const maskImage = useMotionTemplate`radial-gradient(${revealRadius}px circle at ${mouseX}px ${mouseY}px, black 0%, transparent 70%)`;

  const blobs = {
    subtle: { accent: 0.18, ember: 0.12, steel: 0.10 },
    normal: { accent: 0.32, ember: 0.22, steel: 0.18 },
    wild:   { accent: 0.50, ember: 0.36, steel: 0.30 },
  }[blobIntensity] || { accent: 0.32, ember: 0.22, steel: 0.18 };

  return (
    <div
      ref={wrapRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* Layer 1: faint always-on grid */}
      <div className="absolute inset-0 opacity-[0.07]">
        <Grid offsetX={offsetX} offsetY={offsetY} density={density} />
      </div>

      {/* Layer 2: bright grid revealed by cursor */}
      {showSpotlight && (
        <motion.div
          className="absolute inset-0 opacity-60"
          style={{ maskImage, WebkitMaskImage: maskImage }}
        >
          <Grid offsetX={offsetX} offsetY={offsetY} density={density} bright />
        </motion.div>
      )}

      {/* Layer 3: ambient gradient blobs */}
      <div className="absolute inset-0">
        <div
          className="absolute -right-32 -top-32 h-[36rem] w-[36rem] rounded-full blur-[120px]"
          style={{ background: `radial-gradient(circle, rgba(255,70,85,${blobs.accent}), transparent 65%)` }}
        />
        <div
          className="absolute right-[10%] top-[-8%] h-[18rem] w-[18rem] rounded-full blur-[100px]"
          style={{ background: `radial-gradient(circle, rgba(255,122,69,${blobs.ember}), transparent 65%)` }}
        />
        <div
          className="absolute -left-32 -bottom-32 h-[34rem] w-[34rem] rounded-full blur-[120px]"
          style={{ background: `radial-gradient(circle, rgba(58,71,87,${blobs.steel}), transparent 65%)` }}
        />
      </div>

      {/* Layer 4: vignette to hold contrast */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(6,8,12,0.55)_100%)]" />
    </div>
  );
}

function Grid({ offsetX, offsetY, density, bright = false }) {
  const stroke = bright ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.6)';
  return (
    <svg className="absolute inset-0 h-full w-full">
      <defs>
        <motion.pattern
          id={bright ? 'grid-bright' : 'grid-faint'}
          width={density}
          height={density}
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <path d={`M ${density} 0 L 0 0 0 ${density}`} fill="none" stroke={stroke} strokeWidth="1" />
        </motion.pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${bright ? 'grid-bright' : 'grid-faint'})`} />
    </svg>
  );
}
