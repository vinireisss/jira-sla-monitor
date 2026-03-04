// 🎉 Confetti Animation - Pure JavaScript (No Dependencies)
// Based on canvas-confetti but simplified for our use case

class ConfettiGenerator {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.animationFrame = null;
  }

  create() {
    // Create canvas if doesn't exist
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.style.position = 'fixed';
      this.canvas.style.top = '0';
      this.canvas.style.left = '0';
      this.canvas.style.width = '100vw';
      this.canvas.style.height = '100vh';
      this.canvas.style.pointerEvents = 'none';
      this.canvas.style.zIndex = '99999';
      document.body.appendChild(this.canvas);
      
      this.ctx = this.canvas.getContext('2d');
      this.resize();
      
      window.addEventListener('resize', () => this.resize());
    }
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  celebrate(options = {}) {
    const {
      particleCount = 100,
      spread = 70,
      startVelocity = 45,
      decay = 0.9,
      origin = { x: 0.5, y: 0.6 },
      colors = ['#667eea', '#764ba2', '#2ecc71', '#f39c12', '#e74c3c', '#3498db']
    } = options;

    this.create();

    const originX = this.canvas.width * origin.x;
    const originY = this.canvas.height * origin.y;

    // Create particles
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.random() * spread - spread / 2) * Math.PI / 180;
      const velocity = Math.random() * startVelocity + startVelocity / 2;
      
      this.particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 10 - 5,
        decay: decay,
        opacity: 1,
        gravity: 2
      });
    }

    if (!this.animationFrame) {
      this.animate();
    }
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    let activeParticles = 0;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Update position
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      
      // Apply decay
      p.vx *= p.decay;
      p.vy *= p.decay;
      
      // Update rotation
      p.rotation += p.rotationSpeed;
      
      // Fade out
      p.opacity -= 0.01;

      // Remove if out of bounds or faded
      if (p.y > this.canvas.height || p.opacity <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      activeParticles++;

      // Draw particle
      this.ctx.save();
      this.ctx.globalAlpha = p.opacity;
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation * Math.PI / 180);
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      this.ctx.restore();
    }

    if (activeParticles > 0) {
      this.animationFrame = requestAnimationFrame(() => this.animate());
    } else {
      this.animationFrame = null;
      // Remove canvas after animation
      setTimeout(() => {
        if (this.canvas && this.particles.length === 0) {
          document.body.removeChild(this.canvas);
          this.canvas = null;
          this.ctx = null;
        }
      }, 100);
    }
  }

  // Preset celebrations
  basic() {
    this.celebrate({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.5, y: 0.6 }
    });
  }

  fireworks() {
    const count = 3;
    const defaults = {
      origin: { y: 0.7 }
    };

    function fire(particleRatio, opts) {
      confettiInstance.celebrate({
        ...defaults,
        ...opts,
        particleCount: Math.floor(200 * particleRatio)
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });
    
    fire(0.2, {
      spread: 60,
    });
    
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      startVelocity: 45
    });
    
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92
    });
  }

  burst() {
    this.celebrate({
      particleCount: 50,
      spread: 360,
      origin: { x: Math.random(), y: Math.random() - 0.2 }
    });
  }
}

// Global instance
const confettiInstance = new ConfettiGenerator();

// Export functions
window.confetti = {
  celebrate: (options) => confettiInstance.celebrate(options),
  basic: () => confettiInstance.basic(),
  fireworks: () => confettiInstance.fireworks(),
  burst: () => confettiInstance.burst()
};

console.log('🎉 Confetti system loaded!');






