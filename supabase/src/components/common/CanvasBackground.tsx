import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  color: string;
}

const CanvasBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesArray = useRef<Particle[]>([]);
  const animationFrameId = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const setCanvasDimensions = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setCanvasDimensions();

    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#007AFF';
    const particleColor = getComputedStyle(document.documentElement).getPropertyValue('--subtle-text-color').trim() || '#8A8A8E';
    
    particlesArray.current = [];
    const numberOfParticles = Math.floor((canvas.width * canvas.height) / 25000); // Adjust density based on screen size

    for (let i = 0; i < numberOfParticles; i++) {
      const size = Math.random() * 1.5 + 0.5; // Smaller particles
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const speedX = (Math.random() * 0.4 - 0.2) * 0.5; // Slower speed
      const speedY = (Math.random() * 0.4 - 0.2) * 0.5; // Slower speed
      particlesArray.current.push({ x, y, size, speedX, speedY, color: particleColor });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particlesArray.current.length; i++) {
        const p = particlesArray.current[i];
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        p.x += p.speedX;
        p.y += p.speedY;

        if (p.x > canvas.width + p.size || p.x < -p.size) p.speedX *= -1;
        if (p.y > canvas.height + p.size || p.y < -p.size) p.speedY *= -1;

        // Connect lines for nearby particles (subtle effect)
        for (let j = i + 1; j < particlesArray.current.length; j++) {
          const p2 = particlesArray.current[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 100) { // Max distance to connect
            ctx.strokeStyle = themeColor; // Use theme's primary color for lines
            ctx.lineWidth = 0.1; // Very thin lines
            ctx.globalAlpha = Math.max(0, 1 - distance / 100); // Fade lines with distance
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
            ctx.globalAlpha = 1; // Reset global alpha
          }
        }
      }
      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      cancelAnimationFrame(animationFrameId.current);
      setCanvasDimensions();
      // Re-initialize particles for new dimensions, could be more sophisticated
      particlesArray.current = [];
       const newNumberOfParticles = Math.floor((canvas.width * canvas.height) / 25000);
        for (let i = 0; i < newNumberOfParticles; i++) {
            const size = Math.random() * 1.5 + 0.5;
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const speedX = (Math.random() * 0.4 - 0.2) * 0.5;
            const speedY = (Math.random() * 0.4 - 0.2) * 0.5;
            particlesArray.current.push({ x, y, size, speedX, speedY, color: particleColor });
        }
      animate();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [/* dependencies based on theme changes if needed, e.g. current theme state */]);

  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, zIndex: -1, display: 'block' }} />;
};

export default CanvasBackground;
