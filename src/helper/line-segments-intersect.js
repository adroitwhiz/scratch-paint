// eslint-disable-next-line require-jsdoc
export default function lineSegmentsIntersect (p1, p2, p3, p4) {
    const aDx = p2.x - p1.x;
    const aDy = p2.y - p1.y;
    const bDx = p4.x - p3.x;
    const bDy = p4.y - p3.y;

    const s = ((-aDy * (p1.x - p3.x)) + (aDx * (p1.y - p3.y))) / ((-bDx * aDy) + (aDx * bDy));
    const t = ((bDx * (p1.y - p3.y)) - (bDy * (p1.x - p3.x))) / ((-bDx * aDy) + (aDx * bDy));

    return (s >= 0 && s <= 1 && t >= 0 && t <= 1);
}
