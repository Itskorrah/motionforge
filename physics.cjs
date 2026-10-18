/* Physical damped harmonic oscillator; shared verbatim by Node and Chrome.
   m x'' + c x' + k(x - target) = 0. No timestep integrator or easing curve.
   Evaluates position AND velocity at any absolute elapsed time. */
(function (root) {
  'use strict';
  function springState({ position = 0, velocity = 0, target = 1,
                         mass = 1, stiffness = 220, damping = 24, elapsed = 0 }) {
    if (![position, velocity, target, mass, stiffness, damping, elapsed].every(Number.isFinite) ||
        mass <= 0 || stiffness <= 0 || damping < 0 || elapsed < 0) {
      throw new RangeError('Spring requires finite values, mass/stiffness > 0, damping/elapsed >= 0');
    }
    const w0 = Math.sqrt(stiffness / mass);
    const alpha = damping / (2 * mass);
    const offset = position - target;
    const t = elapsed;
    let displacement, speed;
    if (alpha < w0 - 1e-9) { // underdamped
      const wd = Math.sqrt(w0*w0 - alpha*alpha);
      const B = (velocity + alpha*offset) / wd;
      const decay = Math.exp(-alpha*t);
      const cosine = Math.cos(wd*t), sine = Math.sin(wd*t);
      displacement = decay*(offset*cosine + B*sine);
      speed = decay*((-alpha*offset + B*wd)*cosine + (-alpha*B - offset*wd)*sine);
    } else if (alpha > w0 + 1e-9) { // overdamped, stable two-root solution
      const d = Math.sqrt(alpha*alpha - w0*w0);
      const r1 = -alpha + d, r2 = -alpha - d;
      const C1 = (velocity - r2*offset)/(r1-r2), C2 = offset-C1;
      displacement = C1*Math.exp(r1*t) + C2*Math.exp(r2*t);
      speed = r1*C1*Math.exp(r1*t) + r2*C2*Math.exp(r2*t);
    } else { // critically damped
      const B = velocity + w0*offset;
      const decay = Math.exp(-w0*t);
      displacement = (offset + B*t)*decay;
      speed = (B - w0*(offset + B*t))*decay;
    }
    return { position: target + displacement, velocity: speed };
  }
  const api = { springState };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SpringPhysics = api;
})(globalThis);
