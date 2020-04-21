const triangleArea = function (p1, p2, p3) {
    return 0.5 * Math.abs(((p2[0] - p1[0]) * (p3[1] - p1[1])) - ((p3[0] - p1[0]) * (p2[1] - p1[1])));
};

/**
 * Simplify (in-place) a polyline (array of points that form a series of connected lines)
 * @param {Array<Array<number>>} points The paper points
 * @param {number} tolerance The simplification tolerance
 * @returns {Array<Array<number>>} The now-simplified polyline array passed in
 */
export default function simplifyPolyline (points, tolerance) {
    if (points.length < 3) return points;

    // This implements the Visvalingam-Whyatt line simplification algorithm:
    // For every point, check the area of the triangle formed by that point and the previous and next points in the line
    // If that area is below the tolerance threshold, that point is removed
    for (let i = 0; i < points.length - 1; i++) {
        const prevIndex = i === 0 ? points.length - 1 : i - 1;
        const nextIndex = (i + 1) % points.length;
        const dist = triangleArea(points[i], points[prevIndex], points[nextIndex]);

        if (dist < tolerance) {
            points.splice(i, 1);
            i--;
        }
    }

    return points;
}
