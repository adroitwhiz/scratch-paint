// Broadbrush based on http://paperjs.org/tutorials/interaction/working-with-mouse-vectors/
import paper from '@scratch/paper';
import {styleBlob} from '../style-path';
import log from '../../log/log';
import simplifyPolyline from '../simplify-polyline';
import lineSegmentsIntersect from '../line-segments-intersect';

/**
 * Broad brush functions to add as listeners on the mouse. Call them when the corresponding mouse event happens
 * to get the broad brush behavior.
 *
 * Broad brush draws strokes by drawing points equidistant from the mouse event, perpendicular to the
 * direction of motion. Shortcomings are that this path can cross itself, and 180 degree turns result
 * in a flat edge.
 *
 * @param {!Tool} tool paper.js mouse object
 */
class ExperimentalBrushHelper {
    constructor () {
        // Direction vector of the last mouse move
        this.lastVec = null;
        // End point of the last mouse move
        this.lastPoint = null;
        // The path of the brush stroke we are building
        this.finalPath = null;
        this.allPoints = null;

        this.smoothedPoints = null;
        this.unsmoothedPoints = null;

        // Number of points of finalPath that have already been processed
        this.smoothed = 0;
        // Number of steps to wait before performing another amortized smooth
        this.smoothingThreshold = 20;
        // Mouse moves since mouse down
        this.steps = 0;
        // End caps round out corners and are not merged into the path until the end.
        this.endCaps = [];
    }

    onBroadMouseDown (event, tool, options) {
        this.steps = 0;
        this.smoothed = 0;
        tool.minDistance = 1;
        tool.maxDistance = Infinity;
        if (event.event.button > 0) return; // only first mouse button

        this.polyline = new paper.Path([event.point]);

        this.rawLine = new paper.Path([event.point]);
        this.thickLine = new paper.Path([event.point]);

        this.unsmoothedPoints = [event.point];
        this.allPoints = [event.point];
        this.smoothedPoints = [event.point];

        this.polyline.strokeWidth = 1;
        this.polyline.strokeColor = '#000';

        this.rawLine.strokeWidth = 1;
        this.rawLine.strokeColor = '#f00';

        this.thickLine.strokeWidth = 1;
        this.thickLine.strokeColor = '#00f';

        this.finalPath = new paper.Path.Circle({
            center: event.point,
            radius: options.brushSize / 2
        });
        styleBlob(this.finalPath, options);
        this.lastPoint = event.point;
    }

    afterAddingSimplifiedPoints (startIndex, options) {
        if (this.rawLine.segments.length === 2) {
            // Replace circle with path
            this.finalPath.remove();
            this.finalPath = new paper.Path();
            styleBlob(this.finalPath, options);

            const offset = this.rawLine.segments[1].point
                .subtract(this.rawLine.segments[0].point)
                .normalize(options.brushSize / 2)
                .rotate(90);

            this.finalPath.add(this.rawLine.segments[1].point.subtract(offset));
            this.finalPath.add(this.rawLine.segments[0].point.subtract(offset));
            this.finalPath.add(this.rawLine.segments[0].point.add(offset));
            this.finalPath.add(this.rawLine.segments[1].point.add(offset));

            console.log(this.finalPath.segments);
        }

        if (this.rawLine.segments.length > 2) {
            for (let i = startIndex - 1; i < this.rawLine.segments.length - 1; i++) {
                const centerSegment = this.rawLine.segments[i];
                const centerPoint = centerSegment.point;
                const prevPoint = this.rawLine.segments[i - 1].point.subtract(centerPoint);
                const nextPoint = this.rawLine.segments[i + 1].point.subtract(centerPoint);

                const leftTangent = prevPoint.normalize();
                const rightTangent = nextPoint.multiply(-1).normalize();

                let averageNormal = new paper.Point(
                    (leftTangent.x + rightTangent.x) * 0.5,
                    (leftTangent.y + rightTangent.y) * 0.5
                )
                    .normalize(options.brushSize / 2)
                    .rotate(90);

                const isSmooth = prevPoint.getAngle(nextPoint) > 120;

                if (isSmooth) {
                    centerSegment.smooth();
                } else {
                    // Expand pointy points. To avoid things getting too pointy, limit the amount of expansion
                    /*const angle = Math.max(prevPoint.getAngleInRadians(nextPoint) / 2, Math.PI / 8);
                    const sin = Math.sin(angle);
                    averageNormal = averageNormal.divide(sin);*/
                }

                const prevSegmentLeft = this.finalPath.segments[0];
                const prevSegmentRight = this.finalPath.segments[this.finalPath.segments.length - 1];

                prevSegmentLeft.point = centerPoint.add(averageNormal);
                prevSegmentRight.point = centerPoint.subtract(averageNormal);

                const rightNormal = rightTangent.multiply(options.brushSize / 2).rotate(90);

                this.finalPath.insert(0, this.rawLine.segments[i + 1].point.add(rightNormal));
                this.finalPath.add(this.rawLine.segments[i + 1].point.subtract(rightNormal));

                if (isSmooth || true) {
                    prevSegmentLeft.smooth();
                    prevSegmentRight.smooth();
                }

                /*if (lineSegmentsIntersect(
                    this.finalPath.segments[0].point,
                    this.finalPath.segments[this.finalPath.segments.length - 1].point,
                    this.finalPath.segments[1].point,
                    this.finalPath.segments[this.finalPath.segments.length - 2].point
                )) {
                    // this.finalPath.removeSegment(this.finalPath.segments.length - 2);
                    // this.finalPath.removeSegment(1);

                    const ccw = prevPoint.getDirectedAngle(nextPoint) > 0;

                    const pt = this.finalPath.segments[ccw ? 0 : this.finalPath.segments.length - 1].point;

                    this.finalPath.removeSegment(ccw ? 0 : this.finalPath.segments.length - 1);

                    const demo = new paper.Path.Circle({
                        center: pt,
                        radius: 1
                    });

                    demo.strokeWidth = 1;
                    demo.strokeColor = 'red';
                }*/

                //this.finalPath.segments[1].smooth();
                //this.finalPath.segments[this.finalPath.segments.length - 2].smooth();
            }
        }
    }

    onBroadMouseDrag (event, tool, options) {
        this.steps++;

        this.unsmoothedPoints.push(event.point);
        this.allPoints.push(event.point);
        const simplified = simplifyPolyline(this.unsmoothedPoints, 2.5 / paper.view.zoom);
        let addedPoints = false;
        const addIndex = this.smoothedPoints.length;
        if (simplified.length > 2) {
            const lastUnsimplifiedPoint = simplified[simplified.length - 2];
            const lastUnsimplifiedIndex = this.unsmoothedPoints.findIndex(point => point === lastUnsimplifiedPoint);
            this.unsmoothedPoints.splice(0, lastUnsimplifiedIndex);
            for (let i = 1; i < simplified.length - 1; i++) {
                this.smoothedPoints.push(simplified[i]);
                this.rawLine.add(simplified[i]);
            }
            addedPoints = true;
        }
        this.polyline.segments = this.unsmoothedPoints;

        if (addedPoints) this.afterAddingSimplifiedPoints(addIndex, options);

        // this.polyline.simplify(1);
    }

    /**
     * Simplify the path so that it looks almost the same while trying to have a reasonable number of handles.
     * Without this, there would be 2 handles for every mouse move, which would make the path produced basically
     * uneditable. This version of simplify keeps track of how much of the path has already been simplified to
     * avoid repeating work.
     * @param {number} threshold The simplify algorithm must try to stay within this distance of the actual line.
     *     The algorithm will be faster and able to remove more points the higher this number is.
     *     Note that 1 is about the lowest this algorithm can do (the result is about the same when 1 is
     *     passed in as when 0 is passed in)
     */
    simplify () {
        return;
    }

    /**
     * Like paper.Path.unite, but it removes the original 2 paths
     * @param {paper.Path} path1 to merge
     * @param {paper.Path} path2 to merge
     * @return {paper.Path} merged path. Original paths 1 and 2 will be removed from the view.
     */
    union (path1, path2) {
        const temp = path1.unite(path2);
        path1.remove();
        path2.remove();
        return temp;
    }

    onBroadMouseUp (event, tool, options) {
        // If there was only a single click, draw a circle.
        if (this.steps === 0) {
            this.endCaps.length = 0;
            return this.finalPath;
        }

        this.rawLine.add(event.point);
        this.afterAddingSimplifiedPoints(this.rawLine.segments.length - 1, options);
        this.polyline.remove();

        this.finalPath.closePath();

        // Resolve self-crossings
        const newPath =
            this.finalPath
                // .resolveCrossings()
                // .reorient(true /* nonZero */, true /* clockwise */)
                // .reduce({simplify: false});
        if (newPath !== this.finalPath) {
            newPath.copyAttributes(this.finalPath);
            newPath.fillColor = this.finalPath.fillColor;
            this.finalPath.remove();
            this.finalPath = newPath;
        }

        // Try to merge end caps
        for (const cap of this.endCaps) {
            const temp = this.union(this.finalPath, cap);
            if (temp.area >= this.finalPath.area &&
                !(temp instanceof paper.CompoundPath && !(this.finalPath instanceof paper.CompoundPath))) {
                this.finalPath = temp;
            } else {
                // If the union of the two shapes is smaller than the original shape,
                // or it caused the path to become a compound path,
                // then there must have been a glitch with paperjs's unite function.
                // In this case, skip merging that segment. It's not great, but it's
                // better than losing the whole path for instance. (Unfortunately, this
                // happens reasonably often to scribbles, and this code doesn't catch
                // all of the failures.)
                this.finalPath.insertAbove(temp);
                temp.remove();
                log.warn('Skipping a merge.');
            }
        }
        this.endCaps.length = 0;

        return this.finalPath;
    }
}

export default ExperimentalBrushHelper;
