import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay?: number;
  life?: number;
}

interface ParticleCanvasProps {
  burstTrigger?: number;
  burstType?: 'legendary' | 'epic' | 'gold' | 'sparkle';
  reducedMotion?: boolean;
}

export const ParticleCanvas: React.FC<ParticleCanvasProps> = ({
  burstTrigger = 0,
  burstType = 'gold',
  reducedMotion = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Initial ambient particles
    const ambientCount = 35;
    particlesRef.current = [];
    for (let i = 0; i < ambientCount; i++) {
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -Math.random() * 0.6 - 0.1,
        size: Math.random() * 2.2 + 0.8,
        color: Math.random() > 0.6 ? '#60a5fa' : Math.random() > 0.3 ? '#c084fc' : '#fbbf24',
        alpha: Math.random() * 0.5 + 0.1,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.decay) {
          p.alpha -= p.decay;
          if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
          }
        } else {
          // Ambient wrapping
          if (p.y < -10) p.y = canvas.height + 10;
          if (p.x < -10) p.x = canvas.width + 10;
          if (p.x > canvas.width + 10) p.x = -10;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [reducedMotion]);

  // Handle burst effects when burstTrigger increments
  useEffect(() => {
    if (reducedMotion || burstTrigger === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const burstCount = burstType === 'legendary' ? 120 : 60;

    const colors =
      burstType === 'legendary'
        ? ['#fbbf24', '#f59e0b', '#fef08a', '#ffffff', '#eab308']
        : burstType === 'epic'
        ? ['#c084fc', '#a855f7', '#e879f9', '#ffffff', '#38bdf8']
        : ['#60a5fa', '#38bdf8', '#fbbf24', '#ffffff'];

    for (let i = 0; i < burstCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (burstType === 'legendary' ? 9 : 6) + 2;
      particlesRef.current.push({
        x: centerX + (Math.random() - 0.5) * 40,
        y: centerY + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3.5 + 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: Math.random() * 0.02 + 0.012,
      });
    }
  }, [burstTrigger, burstType, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      id="particle-background-canvas"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
};
