/** Swept point vs expanded AABB. Times are seconds, normals face outward. */
export function sweep(x: number, y: number, vx: number, vy: number, dt: number, l: number, t: number, r: number, b: number) { let enter = -Infinity, exit = Infinity, nx = 0, ny = 0; for (const [p, v, lo, hi, ax] of [[x, vx, l, r, 0], [y, vy, t, b, 1]]) {
    if (Math.abs(v) < 1e-8) {
        if (p < lo || p > hi)
            return null;
        continue;
    }
    let a = (lo - p) / v, z = (hi - p) / v;
    const sign = v > 0 ? -1 : 1;
    if (a > z)
        [a, z] = [z, a];
    if (a > enter) {
        enter = a;
        nx = ax === 0 ? sign : 0;
        ny = ax === 1 ? sign : 0;
    }
    exit = Math.min(exit, z);
    if (enter > exit)
        return null;
} if (enter < -.00001 || enter > dt || exit < 0)
    return null; return { time: Math.max(0, enter), nx, ny }; }
