import paper from '@scratch/paper';
import {styleBlob} from '../style-path';
import {traceRaster, combinePolylines} from '../trace-raster';
import simplifyPolyline from '../simplify-polyline';

const stylePreview = function (path, options) {
    path.strokeWidth = options.brushSize;
    path.strokeColor = options.fillColor;
    path.strokeCap = path.strokeJoin = 'round';
};

/**
 * Marching-squares brush tool helper. Rasterizes the brush strokes then un-rasterizes them with the marching squares
 * algorithm.
 *
 * @param {!Tool} tool paper.js mouse object
 */
class MarchingBrushHelper {
    constructor () {
        this.lastPoint = null;
        this.finalPath = null;
        this.firstCircle = null;

        this._strokeCanvas = document.createElement('canvas');
    }
    onSegmentMouseDown (event, tool, options) {
        if (event.event.button > 0) return; // only first mouse button

        tool.minDistance = 2 / paper.view.zoom;
        tool.maxDistance = options.brushSize;

        this.previewPath = new paper.Path([event.point]);

        this.firstCircle = new paper.Path.Circle({
            center: event.point,
            radius: options.brushSize / 2
        });
        this.finalPath = this.firstCircle;
        styleBlob(this.finalPath, options);
        this.lastPoint = event.point;
    }

    onSegmentMouseDrag (event, tool, options) {
        if (event.event.button > 0) return; // only first mouse button

        if (this.firstCircle) this.firstCircle.remove();

        this.previewPath.add(event.point);
        stylePreview(this.previewPath, options);
    }

    onSegmentMouseUp (event, tool, options) {
        // Number of screen-space pixels per rasterized pixel
        const dicingScale = 2;

        if (event.event.button > 0) return; // only first mouse button

        // Ensure that the rasterized brush stroke is always at least 1px thick
        const scaleFactor = Math.max(
            paper.view.zoom / dicingScale,
            1 / (options.brushSize * paper.view.zoom)
        );

        const bounds = this.previewPath.strokeBounds;
        const scaledBounds = bounds.clone();
        scaledBounds.width *= scaleFactor;
        scaledBounds.height *= scaleFactor;

        // Leave enough spacing around the brush stroke for at least 1 pixel of black border
        const offsetX = 3 - (bounds.x % 1);
        const offsetY = 3 - (bounds.y % 1);

        const canvas = this._strokeCanvas;
        const ctx = canvas.getContext('2d');
        canvas.width = Math.ceil(scaledBounds.width + offsetX + 2);
        canvas.height = Math.ceil(scaledBounds.height + offsetY + 2);

        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.translate(offsetX, offsetY);
        ctx.scale(scaleFactor, scaleFactor);
        ctx.translate(-bounds.x, -bounds.y);

        ctx.beginPath();

        const firstPoint = this.previewPath.segments[0].point;
        ctx.moveTo(firstPoint.x, firstPoint.y);

        for (let i = 1; i < this.previewPath.segments.length; i++) {
            const {x, y} = this.previewPath.segments[i].point;
            ctx.lineTo(x, y);
        }

        // Draw the brush stroke twice, once in a slightly larger radius in grey, and once in a smaller radius in white.
        // This softens the edges around the brush stroke, making the "marched" result smoother.
        const onePixel = 1 / scaleFactor;
        ctx.lineJoin = ctx.lineCap = 'round';

        ctx.strokeStyle = '#7f7f7f';
        ctx.lineWidth = options.brushSize + onePixel;
        ctx.stroke();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = options.brushSize - onePixel;
        ctx.stroke();

        const lines = traceRaster(ctx.getImageData(0, 0, canvas.width, canvas.height));
        const polylines = combinePolylines(lines);

        // The first and last points of each polyline are the same, so remove the last point
        for (const polyline of polylines) {
            polyline.pop();

            // Before calling simplify() on the combined path, simplify the polylines with a much faster algorithm
            simplifyPolyline(polyline, 0.25);
        }

        const paths = polylines.map(polyline => new paper.Path({
            segments: polyline.map(point =>
                new paper.Point(point[0], point[1])
            ),
            closed: true
        }));

        for (const path of paths) {
            for (const segment of path.segments) {
                const middlePoint = segment.point;
                const prevPoint = segment.previous.point.subtract(middlePoint);
                const nextPoint = segment.next.point.subtract(middlePoint);

                if (prevPoint.getAngle(nextPoint) > 135) segment.smooth();
            }
        }

        let combinedPath = new paper.CompoundPath({
            children: paths,
            pivot: [0, 0],
            position: [bounds.x - (offsetX / scaleFactor), bounds.y - (offsetY / scaleFactor)],
            scaling: 1 / scaleFactor,
            applyMatrix: true
        });

        // TODO: Selection hover outlines appear in the wrong place if the pivot is set to [0, 0].
        // Not sure if this is a bug in paper.js, the selection tool, or this brush.
        combinedPath.pivot = null;

        // TODO: simplifying the path at all will completely ruin the uniform line thickness,
        // no matter how low the tolerance is set.
        /* combinedPath.closed = false;
        combinedPath.simplify(0.05);
        combinedPath.closed = true; */

        combinedPath = combinedPath.reduce();

        styleBlob(combinedPath, options);

        this.previewPath.remove();
        return combinedPath;
    }
}

export default MarchingBrushHelper;
