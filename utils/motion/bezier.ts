/**
 * @file utils/motion/bezier.ts
 * @description Cubic-bezier easing evaluator — the CSS `cubic-bezier(x1,y1,x2,y2)`
 * timing function as a scalar map `x ∈ [0,1] → y`. Solving `x(s)=x` for the
 * curve parameter `s` then reading `y(s)` mirrors the Web Animations
 * implementation: Newton-Raphson first (converges in ~4 iterations on
 * well-behaved curves), bisection fallback when the tangent goes flat — so
 * pathological control points still produce a correct value instead of a
 * NaN or an unbounded wander. The evaluator is a pure scalar function —
 * allocating it once per module keeps the per-frame call zero-allocation
 * and monomorphic (animation frame budget).
 */

/**
 * Samples the cubic-bezier parametric curve — `B(s) = (1−s)³·0 +
 * 3(1−t)²s·a1 + 3(1−s)s²·a2 + s³` — for one axis pair.
 * @param s Curve parameter 0..1.
 * @param a1 First control point ordinate.
 * @param a2 Second control point ordinate.
 * @returns The axis value at `s`.
 */
const sample = (s: number, a1: number, a2: number): number => {
  const u = 1 - s

  return 3 * u * u * s * a1 + 3 * u * s * s * a2 + s * s * s
}

/**
 * The curve's derivative dB/ds for one axis — `3(1−s)²·a1 +
 * 6(1−s)s·(a2−a1) + 3s²·(1−a2)`.
 * @param s Curve parameter 0..1.
 * @param a1 First control point ordinate.
 * @param a2 Second control point ordinate.
 * @returns The axis slope at `s`.
 */
const slope = (s: number, a1: number, a2: number): number => {
  const u = 1 - s

  return 3 * u * u * a1 + 6 * u * s * (a2 - a1) + 3 * s * s * (1 - a2)
}

/**
 * Builds a `cubic-bezier(x1,y1,x2,y2)` easing function. The endpoints are
 * pinned to (0,0) and (1,1) like the CSS function — callers keep control
 * points inside the unit square; out-of-range x clamps to the endpoints.
 * @param x1 First control point x (0..1).
 * @param y1 First control point y.
 * @param x2 Second control point x (0..1).
 * @param y2 Second control point y.
 * @returns The easing map `x ∈ [0,1] → y`.
 */
export const cubicBezier = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
): ((x: number) => number) => {
  /**
   * Solves `x(s) = x` for s — Newton-Raphson seeded with x itself, then
   * bisection when the tangent flattens below NEWTON_MIN_SLOPE (a
   * near-zero slope makes Newton's step diverge; the curve is still
   * monotone-in-x for sane control points so bisection always lands).
   * @param x Progress input 0..1.
   * @returns The y ordinate of the curve point whose x is `x`.
   */
  const ease = (x: number): number => {
    if (x <= 0) return 0

    if (x >= 1) return 1

    let s = x

    for (let i = 0; i < 8; i++) {
      const err = sample(s, x1, x2) - x

      if (Math.abs(err) < 1e-6) return sample(s, y1, y2)

      const d = slope(s, x1, x2)

      if (Math.abs(d) < 1e-6) break

      s -= err / d

      if (s < 0) s = 0

      if (s > 1) s = 1
    }

    let lo = 0

    let hi = 1

    s = x

    while (hi - lo > 1e-7) {
      const v = sample(s, x1, x2)

      if (Math.abs(v - x) < 1e-7) break

      if (v < x) lo = s
      else hi = s

      s = (lo + hi) / 2
    }

    return sample(s, y1, y2)
  }

  return ease
}
