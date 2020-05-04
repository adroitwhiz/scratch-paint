const pointSegmentDistance = function (p, p1, p2) {
    let x = p1.x;
    let y = p1.y;
    const dx = p2.x - x;
    const dy = p2.y - y;

    if (dx !== 0 || dy !== 0) {
        let t = (((p.x - x) * dx) + ((p.y - y) * dy)) / ((dx * dx) + (dy * dy));

        t = Math.max(0, Math.min(t, 1));

        x += dx * t;
        y += dy * t;
    }

    const distX = p.x - x;
    const distY = p.y - y;

    return Math.sqrt((distX * distX) + (distY * distY));
};

const triangleArea = function (p1, p2, p3) {
    return 0.5 * Math.abs(((p2.x - p1.x) * (p3.y - p1.y)) - ((p3.x - p1.x) * (p2.y - p1.y)));
};

/**
 * Simplify a polyline (array of points that form a series of connected lines)
 * @param {*} points The paper points
 * @param {*} tolerance The simplification tolerance
 * @returns {*} Simplified array of points
 */
export default function simplifyPolyline (points, tolerance) {
    points = points.slice(0);
    if (points.length < 3) return points;

    for (let i = 1; i < points.length - 1; i++) {
        // const dist = pointSegmentDistance(points[i], points[i - 1], points[i + 1]);
        const dist = triangleArea(points[i], points[i - 1], points[i + 1]);

        if (dist < tolerance) {
            points.splice(i, 1);
            i--;
        }
    }

    return points;
}
