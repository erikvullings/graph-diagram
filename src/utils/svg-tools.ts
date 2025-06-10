export interface NodeSVG {
  x: number;
  y: number;
  size: number; // radius of the node
  label?: string;
  image?: string;
  color?: string;
}

export interface EdgeSVG {
  source: string;
  target: string;
  label?: string;
  type:
    | "line"
    | "arrow"
    | "doubleArrow"
    | "curved"
    | "curvedArrow"
    | "curvedDoubleArrow";
  size: number; // thickness of the edge
  color?: string; // color of the edge
}

export interface GraphSVG {
  nodes: { [key: string]: NodeSVG };
  edges: EdgeSVG[];
}

type Bounds = {
  minX: number;
  minY: number;
  width: number;
  height: number;
};
interface SVGResult {
  paths: string;
  labels: string;
  defs: string;
}

// New function to group edges by source-target pairs
const groupEdgesByPair = (edges: EdgeSVG[]): Map<string, EdgeSVG[]> => {
  const groups = new Map<string, EdgeSVG[]>();

  for (const edge of edges) {
    const key = `${edge.source}-${edge.target}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(edge);
  }

  return groups;
};

const convertGraphToSVGEdges = (
  graph: GraphSVG,
  bounds: Bounds,
  optimize: boolean = true
): SVGResult => {
  const svgPaths: string[] = [];
  const svgLabels: string[] = [];
  const svgDefs: string[] = [];

  // Group edges by source-target pairs
  const edgeGroups = groupEdgesByPair(graph.edges);

  for (const [_pairKey, edges] of edgeGroups) {
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const sourceNode = graph.nodes[edge.source];
      const targetNode = graph.nodes[edge.target];

      if (!sourceNode || !targetNode) continue;

      // Calculate curvature multiplier for multiple edges
      const curvatureMultiplier =
        edges.length > 1 ? (i - (edges.length - 1) / 2) * 0.8 : 0;

      let pathData = createEdgePath(
        sourceNode,
        targetNode,
        edge,
        curvatureMultiplier
      );
      if (pathData) {
        if (optimize) {
          pathData = optimizePath(pathData);
        }
        const color = edge.color || "currentColor";
        svgPaths.push(`<path d="${pathData}" fill="${color}" />`);

        // Add edge label if present
        if (edge.label) {
          const labelResult = createEdgeLabel(
            sourceNode,
            targetNode,
            edge,
            bounds,
            curvatureMultiplier
          );
          if (labelResult.includes("<defs>")) {
            // Extract defs and label parts for curved text
            const defsMatch = labelResult.match(/<defs>(.*?)<\/defs>/s);
            const textMatch = labelResult.match(/<text[^>]*>.*?<\/text>/s);
            if (defsMatch) svgDefs.push(defsMatch[1]);
            if (textMatch) svgLabels.push(textMatch[0]);
          } else {
            svgLabels.push(labelResult);
          }
        }
      }
    }
  }
  console.log(svgPaths);
  return {
    paths: svgPaths.join("\n"),
    labels: svgLabels.join("\n"),
    defs: svgDefs.join("\n"),
  };
};

export const estimateSvgFontSize = ({
  label,
  availableWidth,
  availableHeight,
  minFontSize = 8,
  maxFontSize = 24,
  fillRatio = 0.6,
  hideThreshold = 6,
  viewBoxWidth = 800,
  viewBoxHeight = 800,
  assumedRenderWidth = 800,
  assumedRenderHeight = 800,
}: {
  label: string;
  availableWidth: number;
  availableHeight: number;
  minFontSize?: number;
  maxFontSize?: number;
  fillRatio?: number;
  hideThreshold?: number;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
  assumedRenderWidth?: number;
  assumedRenderHeight?: number;
}): number => {
  const charCount = label.length;
  const maxWidth = availableWidth * fillRatio;
  const maxHeight = availableHeight * fillRatio;

  // Calculate scaling factor based on viewBox vs assumed render size
  // When viewBox is smaller than assumed size, we need to scale DOWN the font
  const scaleX = viewBoxWidth / assumedRenderWidth;
  const scaleY = viewBoxHeight / assumedRenderHeight;
  const scale = Math.max(scaleX, scaleY); // Use max to ensure text fits

  // Solve for fontSize such that: charCount * fontSize * 0.6 <= maxWidth
  const sizeByWidth = maxWidth / (charCount * 0.5); // Reduced character width ratio
  const sizeByHeight = maxHeight * 0.8; // Reduce height usage

  let estimatedSize = Math.floor(Math.min(sizeByWidth, sizeByHeight));

  // Apply scaling factor - this now correctly scales down when viewBox is small
  estimatedSize *= scale;

  estimatedSize = Math.max(minFontSize, Math.min(maxFontSize, estimatedSize));

  return estimatedSize < hideThreshold ? 0 : +estimatedSize.toFixed(1);
};

const createEdgeLabel = (
  source: NodeSVG,
  target: NodeSVG,
  edge: EdgeSVG,
  bounds: Bounds,
  curvatureMultiplier: number = 0
): string => {
  const color = edge.color || "currentColor";
  const isCurved = edge.type.includes("curved") || curvatureMultiplier !== 0;
  const label = edge.label || "";

  if (isCurved) {
    // Create offset curved path for text with adjusted curvature
    const pathId = `path-${source.x.toFixed(1)}-${source.y.toFixed(
      1
    )}-${target.x.toFixed(1)}-${target.y.toFixed(1)}-${curvatureMultiplier}`;

    // Reduced offset distance for better text placement
    const offsetDistance = Math.max(edge.size * 1.5 + 8, 6);

    // Create offset control points with reduced curvature for text path
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / distance;
    const perpY = dx / distance;

    // Reduce curvature for text path (50% of edge curvature)
    const textControlPoints = calculateBezierControlPoints(
      source,
      target,
      curvatureMultiplier * 0.5
    );
    const offsetControlX = textControlPoints.cp1x + perpX * offsetDistance;
    const offsetControlY = textControlPoints.cp1y + perpY * offsetDistance;

    const fontSize = estimateSvgFontSize({
      label,
      availableWidth: Math.abs(dx),
      availableHeight: Math.abs(dy),
      viewBoxWidth: bounds.width,
      viewBoxHeight: bounds.height,
    });

    if (fontSize === 0) return "";

    // Determine text direction to avoid upside-down text
    const shouldReverse = dx < 0;
    const pathData = shouldReverse
      ? `M ${target.x} ${target.y} Q ${offsetControlX} ${offsetControlY} ${source.x} ${source.y}`
      : `M ${source.x} ${source.y} Q ${offsetControlX} ${offsetControlY} ${target.x} ${target.y}`;

    return `<defs>
              <path id="${pathId}" d="${pathData}" />
            </defs>
            <text fill="${color}" font-size="${fontSize}">
              <textPath href="#${pathId}" startOffset="50%" text-anchor="middle" dominant-baseline="central">
                ${label}
              </textPath>
            </text>`;
  } else {
    // Straight line label with better orientation handling
    const { x, y, angle } = calculateLabelPosition(source, target, edge);
    const offsetDistance = Math.max(edge.size * 1.5 + 8, 6);
    const offsetX = Math.sin((angle * Math.PI) / 180) * offsetDistance;
    const offsetY = -Math.cos((angle * Math.PI) / 180) * offsetDistance;

    const fontSize = estimateSvgFontSize({
      label,
      availableWidth: Math.abs(target.x - source.x),
      availableHeight: Math.abs(target.y - source.y),
    });

    if (fontSize === 0) return "";

    // Adjust angle to prevent upside-down text
    let adjustedAngle = angle;
    if (angle > 90 || angle < -90) {
      adjustedAngle = angle + 180;
    }

    return `<text x="${x + offsetX}" y="${
      y + offsetY
    }" text-anchor="middle" dominant-baseline="middle" 
            transform="rotate(${adjustedAngle}, ${x + offsetX}, ${
      y + offsetY
    })" 
            fill="${color}" font-size="${fontSize}">
            ${label}
           </text>`;
  }
};

const calculateLabelPosition = (
  source: NodeSVG,
  target: NodeSVG,
  edge: EdgeSVG
): { x: number; y: number; angle: number } => {
  const isCurved = edge.type.includes("curved");

  if (isCurved) {
    const controlPoints = calculateBezierControlPoints(source, target);
    // For quadratic curve, midpoint is at t=0.5
    const t = 0.5;
    const x =
      (1 - t) * (1 - t) * source.x +
      2 * (1 - t) * t * controlPoints.cp1x +
      t * t * target.x;
    const y =
      (1 - t) * (1 - t) * source.y +
      2 * (1 - t) * t * controlPoints.cp1y +
      t * t * target.y;

    // Calculate tangent at midpoint for rotation
    const tangentX =
      2 * (1 - t) * (controlPoints.cp1x - source.x) +
      2 * t * (target.x - controlPoints.cp1x);
    const tangentY =
      2 * (1 - t) * (controlPoints.cp1y - source.y) +
      2 * t * (target.y - controlPoints.cp1y);
    const angle = (Math.atan2(tangentY, tangentX) * 180) / Math.PI;

    return { x, y, angle };
  } else {
    // Straight line
    const x = (source.x + target.x) / 2;
    const y = (source.y + target.y) / 2;
    const angle =
      (Math.atan2(target.y - source.y, target.x - source.x) * 180) / Math.PI;

    return { x, y, angle };
  }
};

const optimizePath = (pathData: string): string => {
  // Parse path commands and coordinates
  const commands = pathData.match(/[MLQCZ][^MLQCZ]*/g);
  if (!commands) return pathData;

  let optimized = "";
  let currentX = 0;
  let currentY = 0;

  for (const command of commands) {
    const letter = command[0];
    const coords = command.slice(1).trim();

    if (letter === "Z") {
      optimized += "z";
      continue;
    }

    const numbers = coords
      .split(/[\s,]+/)
      .filter((s) => s)
      .map(Number);

    switch (letter) {
      case "M":
        if (numbers.length >= 2) {
          const x = +numbers[0].toFixed(1);
          const y = +numbers[1].toFixed(1);
          optimized += `M${x},${y}`;
          currentX = x;
          currentY = y;
        }
        break;

      case "L":
        if (numbers.length >= 2) {
          const x = +numbers[0].toFixed(1);
          const y = +numbers[1].toFixed(1);
          const dx = +(x - currentX).toFixed(1);
          const dy = +(y - currentY).toFixed(1);
          optimized += `l${dx},${dy}`;
          currentX = x;
          currentY = y;
        }
        break;

      case "Q":
        if (numbers.length >= 4) {
          const x1 = +numbers[0].toFixed(1);
          const y1 = +numbers[1].toFixed(1);
          const x = +numbers[2].toFixed(1);
          const y = +numbers[3].toFixed(1);
          const dx1 = +(x1 - currentX).toFixed(1);
          const dy1 = +(y1 - currentY).toFixed(1);
          const dx = +(x - currentX).toFixed(1);
          const dy = +(y - currentY).toFixed(1);
          optimized += `q${dx1},${dy1},${dx},${dy}`;
          currentX = x;
          currentY = y;
        }
        break;

      case "C":
        if (numbers.length >= 6) {
          const x1 = +numbers[0].toFixed(1);
          const y1 = +numbers[1].toFixed(1);
          const x2 = +numbers[2].toFixed(1);
          const y2 = +numbers[3].toFixed(1);
          const x = +numbers[4].toFixed(1);
          const y = +numbers[5].toFixed(1);
          const dx1 = +(x1 - currentX).toFixed(1);
          const dy1 = +(y1 - currentY).toFixed(1);
          const dx2 = +(x2 - currentX).toFixed(1);
          const dy2 = +(y2 - currentY).toFixed(1);
          const dx = +(x - currentX).toFixed(1);
          const dy = +(y - currentY).toFixed(1);
          optimized += `c${dx1},${dy1},${dx2},${dy2},${dx},${dy}`;
          currentX = x;
          currentY = y;
        }
        break;
    }
  }

  return optimized;
};

const createEdgePath = (
  source: NodeSVG,
  target: NodeSVG,
  edge: EdgeSVG,
  curvatureMultiplier: number = 0
): string => {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  // If nodes are too close, don't draw edge
  if (distance < source.size + target.size) return "";
  console.log(distance);

  // Unit vector from source to target
  const ux = dx / distance;
  const uy = dy / distance;

  const thickness = edge.size;
  const isCurved = edge.type.includes("curved") || curvatureMultiplier !== 0;

  let startX: number, startY: number, endX: number, endY: number;

  if (isCurved) {
    // For curved edges, calculate intersection points with the actual curve
    const curvePoints = calculateCurveNodeIntersections(
      source,
      target,
      curvatureMultiplier
    );
    startX = curvePoints.startX;
    startY = curvePoints.startY;
    endX = curvePoints.endX;
    endY = curvePoints.endY;
  } else {
    // For straight edges, use the original method
    startX = source.x + ux * source.size;
    startY = source.y + uy * source.size;
    endX = target.x - ux * target.size;
    endY = target.y - uy * target.size;
  }
  console.log(edge.type);

  switch (edge.type) {
    case "line":
      if (curvatureMultiplier !== 0) {
        return createCurvedLinePath(
          source,
          target,
          startX,
          startY,
          endX,
          endY,
          thickness,
          curvatureMultiplier
        );
      }
      return createStraightLinePath(startX, startY, endX, endY, thickness);

    case "arrow":
      if (curvatureMultiplier !== 0) {
        return createCurvedArrowPath(
          source,
          target,
          startX,
          startY,
          endX,
          endY,
          thickness,
          false,
          true,
          curvatureMultiplier
        );
      }
      return createArrowPath(
        startX,
        startY,
        endX,
        endY,
        thickness,
        false,
        true
      );

    case "doubleArrow":
      if (curvatureMultiplier !== 0) {
        return createCurvedArrowPath(
          source,
          target,
          startX,
          startY,
          endX,
          endY,
          thickness,
          true,
          true,
          curvatureMultiplier
        );
      }
      return createArrowPath(startX, startY, endX, endY, thickness, true, true);

    case "curved":
      return createCurvedLinePath(
        source,
        target,
        startX,
        startY,
        endX,
        endY,
        thickness,
        curvatureMultiplier
      );

    case "curvedArrow":
      return createCurvedArrowPath(
        source,
        target,
        startX,
        startY,
        endX,
        endY,
        thickness,
        false,
        true,
        curvatureMultiplier
      );

    case "curvedDoubleArrow":
      return createCurvedArrowPath(
        source,
        target,
        startX,
        startY,
        endX,
        endY,
        thickness,
        true,
        true,
        curvatureMultiplier
      );

    default:
      return "";
  }
};

const calculateCurveNodeIntersections = (
  source: NodeSVG,
  target: NodeSVG,
  curvatureMultiplier: number = 0
): { startX: number; startY: number; endX: number; endY: number } => {
  const controlPoints = calculateBezierControlPoints(
    source,
    target,
    curvatureMultiplier
  );

  // Find intersection with source node circle
  const startIntersection = findCurveCircleIntersection(
    source.x,
    source.y,
    controlPoints.cp1x,
    controlPoints.cp1y,
    target.x,
    target.y,
    source.x,
    source.y,
    source.size,
    true // from start
  );

  // Find intersection with target node circle
  const endIntersection = findCurveCircleIntersection(
    source.x,
    source.y,
    controlPoints.cp1x,
    controlPoints.cp1y,
    target.x,
    target.y,
    target.x,
    target.y,
    target.size,
    false // from end
  );

  return {
    startX: startIntersection.x,
    startY: startIntersection.y,
    endX: endIntersection.x,
    endY: endIntersection.y,
  };
};

const findCurveCircleIntersection = (
  p0x: number,
  p0y: number, // curve start
  p1x: number,
  p1y: number, // curve control point
  p2x: number,
  p2y: number, // curve end
  cx: number,
  cy: number, // circle center
  r: number, // circle radius
  fromStart: boolean // true to find intersection from start, false from end
): { x: number; y: number } => {
  // Sample points along the curve to find intersection
  const samples = 100;
  let bestT = fromStart ? 0 : 1;
  let bestDistance = Infinity;

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = (1 - t) * (1 - t) * p0x + 2 * (1 - t) * t * p1x + t * t * p2x;
    const y = (1 - t) * (1 - t) * p0y + 2 * (1 - t) * t * p1y + t * t * p2y;

    const distance = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
    const targetDistance = r;

    if (Math.abs(distance - targetDistance) < bestDistance) {
      bestDistance = Math.abs(distance - targetDistance);
      bestT = t;
    }
  }

  // Refine with binary search
  let tMin = Math.max(0, bestT - 1 / samples);
  let tMax = Math.min(1, bestT + 1 / samples);

  for (let iter = 0; iter < 20; iter++) {
    const tMid = (tMin + tMax) / 2;
    const x =
      (1 - tMid) * (1 - tMid) * p0x +
      2 * (1 - tMid) * tMid * p1x +
      tMid * tMid * p2x;
    const y =
      (1 - tMid) * (1 - tMid) * p0y +
      2 * (1 - tMid) * tMid * p1y +
      tMid * tMid * p2y;

    const distance = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));

    if (distance < r) {
      if (fromStart) tMin = tMid;
      else tMax = tMid;
    } else {
      if (fromStart) tMax = tMid;
      else tMin = tMid;
    }
  }

  const finalT = (tMin + tMax) / 2;
  const finalX =
    (1 - finalT) * (1 - finalT) * p0x +
    2 * (1 - finalT) * finalT * p1x +
    finalT * finalT * p2x;
  const finalY =
    (1 - finalT) * (1 - finalT) * p0y +
    2 * (1 - finalT) * finalT * p1y +
    finalT * finalT * p2y;

  return { x: finalX, y: finalY };
};

const createStraightLinePath = (
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  thickness: number
): string => {
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) return "";

  // Perpendicular vector for thickness
  const perpX = ((-dy / length) * thickness) / 2;
  const perpY = ((dx / length) * thickness) / 2;

  // Create rectangle path
  const x1 = startX + perpX;
  const y1 = startY + perpY;
  const x2 = startX - perpX;
  const y2 = startY - perpY;
  const x3 = endX - perpX;
  const y3 = endY - perpY;
  const x4 = endX + perpX;
  const y4 = endY + perpY;

  return `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;
};

const createArrowPath = (
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  thickness: number,
  startArrow: boolean,
  endArrow: boolean
): string => {
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) return "";

  const ux = dx / length;
  const uy = dy / length;
  const perpX = (-uy * thickness) / 2;
  const perpY = (ux * thickness) / 2;

  // Better arrow head scaling for thin lines
  const arrowLength = Math.max(thickness * 2, Math.min(thickness * 3.5, 12));
  const arrowWidth = Math.max(thickness * 1.2, Math.min(thickness * 2.2, 8));

  let adjustedStartX = startX;
  let adjustedStartY = startY;
  let adjustedEndX = endX;
  let adjustedEndY = endY;

  // Adjust line endpoints for arrow heads
  if (startArrow) {
    adjustedStartX += ux * arrowLength;
    adjustedStartY += uy * arrowLength;
  }
  if (endArrow) {
    adjustedEndX -= ux * arrowLength;
    adjustedEndY -= uy * arrowLength;
  }

  // Main line body
  const lineX1 = adjustedStartX + perpX;
  const lineY1 = adjustedStartY + perpY;
  const lineX2 = adjustedStartX - perpX;
  const lineY2 = adjustedStartY - perpY;
  const lineX3 = adjustedEndX - perpX;
  const lineY3 = adjustedEndY - perpY;
  const lineX4 = adjustedEndX + perpX;
  const lineY4 = adjustedEndY + perpY;

  let path = `M ${lineX1} ${lineY1} L ${lineX2} ${lineY2} L ${lineX3} ${lineY3} L ${lineX4} ${lineY4} Z`;

  // Add start arrow
  if (startArrow) {
    const arrowPerpX = (-uy * arrowWidth) / 2;
    const arrowPerpY = (ux * arrowWidth) / 2;

    path += ` M ${startX} ${startY}`;
    path += ` L ${adjustedStartX + arrowPerpX} ${adjustedStartY + arrowPerpY}`;
    path += ` L ${adjustedStartX - arrowPerpX} ${
      adjustedStartY - arrowPerpY
    } Z`;
  }

  // Add end arrow
  if (endArrow) {
    const arrowPerpX = (-uy * arrowWidth) / 2;
    const arrowPerpY = (ux * arrowWidth) / 2;

    path += ` M ${endX} ${endY}`;
    path += ` L ${adjustedEndX + arrowPerpX} ${adjustedEndY + arrowPerpY}`;
    path += ` L ${adjustedEndX - arrowPerpX} ${adjustedEndY - arrowPerpY} Z`;
  }

  return path;
};

const createCurvedLinePath = (
  source: NodeSVG,
  target: NodeSVG,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  thickness: number,
  curvatureMultiplier: number = 0
): string => {
  const controlPoints = calculateBezierControlPoints(
    source,
    target,
    curvatureMultiplier
  );
  return createCurvedPathWithThickness(
    startX,
    startY,
    controlPoints.cp1x,
    controlPoints.cp1y,
    controlPoints.cp2x,
    controlPoints.cp2y,
    endX,
    endY,
    thickness
  );
};

const createCurvedArrowPath = (
  source: NodeSVG,
  target: NodeSVG,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  thickness: number,
  startArrow: boolean,
  endArrow: boolean,
  curvatureMultiplier: number = 0
): string => {
  const controlPoints = calculateBezierControlPoints(
    source,
    target,
    curvatureMultiplier
  );

  // Better arrow head scaling for thin lines
  const arrowLength = Math.max(thickness * 2, Math.min(thickness * 3.5, 12));
  const arrowWidth = Math.max(thickness * 1.2, Math.min(thickness * 2.2, 8));

  // Calculate tangent vectors at actual curve endpoints for arrow positioning
  const startTangentX = 2 * (controlPoints.cp1x - startX);
  const startTangentY = 2 * (controlPoints.cp1y - startY);
  const startTangentLength = Math.sqrt(
    startTangentX * startTangentX + startTangentY * startTangentY
  );

  const endTangentX = 2 * (endX - controlPoints.cp2x);
  const endTangentY = 2 * (endY - controlPoints.cp2y);
  const endTangentLength = Math.sqrt(
    endTangentX * endTangentX + endTangentY * endTangentY
  );

  let adjustedStartX = startX;
  let adjustedStartY = startY;
  let adjustedEndX = endX;
  let adjustedEndY = endY;

  // Adjust curve endpoints for arrows
  if (startArrow && startTangentLength > 0) {
    const ux = startTangentX / startTangentLength;
    const uy = startTangentY / startTangentLength;
    adjustedStartX += ux * arrowLength;
    adjustedStartY += uy * arrowLength;
  }

  if (endArrow && endTangentLength > 0) {
    const ux = endTangentX / endTangentLength;
    const uy = endTangentY / endTangentLength;
    adjustedEndX -= ux * arrowLength;
    adjustedEndY -= uy * arrowLength;
  }

  // Create curved path
  let path = createCurvedPathWithThickness(
    adjustedStartX,
    adjustedStartY,
    controlPoints.cp1x,
    controlPoints.cp1y,
    controlPoints.cp2x,
    controlPoints.cp2y,
    adjustedEndX,
    adjustedEndY,
    thickness
  );

  // Add arrows
  if (startArrow && startTangentLength > 0) {
    const ux = startTangentX / startTangentLength;
    const uy = startTangentY / startTangentLength;
    const perpX = (-uy * arrowWidth) / 2;
    const perpY = (ux * arrowWidth) / 2;

    path += ` M ${startX} ${startY}`;
    path += ` L ${adjustedStartX + perpX} ${adjustedStartY + perpY}`;
    path += ` L ${adjustedStartX - perpX} ${adjustedStartY - perpY} Z`;
  }

  if (endArrow && endTangentLength > 0) {
    const ux = endTangentX / endTangentLength;
    const uy = endTangentY / endTangentLength;
    const perpX = (-uy * arrowWidth) / 2;
    const perpY = (ux * arrowWidth) / 2;

    path += ` M ${endX} ${endY}`;
    path += ` L ${adjustedEndX + perpX} ${adjustedEndY + perpY}`;
    path += ` L ${adjustedEndX - perpX} ${adjustedEndY - perpY} Z`;
  }

  return path;
};

const calculateBezierControlPoints = (
  source: NodeSVG,
  target: NodeSVG,
  curvatureMultiplier: number = 0
) => {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Base curvature reduced for less dramatic curves
  const baseCurvature = distance * 0.12;
  const curvature = baseCurvature + baseCurvature * curvatureMultiplier;

  // Perpendicular vector for curve direction
  const perpX = -dy / distance;
  const perpY = dx / distance;

  // Single control point at the middle of the curve
  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2;
  const cpX = midX + perpX * curvature;
  const cpY = midY + perpY * curvature;

  return { cp1x: cpX, cp1y: cpY, cp2x: cpX, cp2y: cpY };
};

const createCurvedPathWithThickness = (
  startX: number,
  startY: number,
  cp1x: number,
  cp1y: number,
  cp2x: number,
  cp2y: number,
  endX: number,
  endY: number,
  thickness: number
): string => {
  const halfThickness = thickness / 2;

  // For a quadratic curve with single control point, we can create offset curves more efficiently
  // Calculate normals at start, middle, and end points
  const startTangent = { x: cp1x - startX, y: cp1y - startY };
  const startLength = Math.sqrt(
    startTangent.x * startTangent.x + startTangent.y * startTangent.y
  );
  const startNormal =
    startLength > 0
      ? { x: -startTangent.y / startLength, y: startTangent.x / startLength }
      : { x: 0, y: 1 };

  const endTangent = { x: endX - cp1x, y: endY - cp1y };
  const endLength = Math.sqrt(
    endTangent.x * endTangent.x + endTangent.y * endTangent.y
  );
  const endNormal =
    endLength > 0
      ? { x: -endTangent.y / endLength, y: endTangent.x / endLength }
      : { x: 0, y: 1 };

  // Calculate offset points
  const topStart = {
    x: startX + startNormal.x * halfThickness,
    y: startY + startNormal.y * halfThickness,
  };
  const bottomStart = {
    x: startX - startNormal.x * halfThickness,
    y: startY - startNormal.y * halfThickness,
  };
  const topEnd = {
    x: endX + endNormal.x * halfThickness,
    y: endY + endNormal.y * halfThickness,
  };
  const bottomEnd = {
    x: endX - endNormal.x * halfThickness,
    y: endY - endNormal.y * halfThickness,
  };

  // Offset control point - average of start and end normals for smoother curve
  const avgNormalX = (startNormal.x + endNormal.x) / 2;
  const avgNormalY = (startNormal.y + endNormal.y) / 2;
  const avgLength = Math.sqrt(
    avgNormalX * avgNormalX + avgNormalY * avgNormalY
  );
  const normalizedAvgNormal =
    avgLength > 0
      ? { x: avgNormalX / avgLength, y: avgNormalY / avgLength }
      : startNormal;

  const topControl = {
    x: cp1x + normalizedAvgNormal.x * halfThickness,
    y: cp1y + normalizedAvgNormal.y * halfThickness,
  };
  const bottomControl = {
    x: cp1x - normalizedAvgNormal.x * halfThickness,
    y: cp1y - normalizedAvgNormal.y * halfThickness,
  };

  // Create path with quadratic curves
  let path = `M ${topStart.x} ${topStart.y}`;
  path += ` Q ${topControl.x} ${topControl.y} ${topEnd.x} ${topEnd.y}`;
  path += ` L ${bottomEnd.x} ${bottomEnd.y}`;
  path += ` Q ${bottomControl.x} ${bottomControl.y} ${bottomStart.x} ${bottomStart.y} Z`;

  return path;
};

export const convertGraphToSVG = async (
  graph: GraphSVG,
  options: {
    width?: number;
    height?: number;
    padding?: number;
    backgroundColor?: string;
    embedImages?: boolean;
    optimize?: boolean;
  } = {}
): Promise<string> => {
  const {
    width = 800,
    height = 600,
    padding = 20,
    backgroundColor = "transparent",
    embedImages = true,
    optimize = true,
  } = options;

  // Calculate bounding box of all nodes
  const bounds = calculateGraphBounds(graph, { padding });

  // Use calculated bounds or provided dimensions
  const svgWidth = width || bounds.width;
  const svgHeight = height || bounds.height;

  // Generate edges SVG
  const {
    paths: edgesSVG,
    defs,
    labels,
  } = convertGraphToSVGEdges(graph, bounds, optimize);

  // Generate nodes SVG
  const nodesSVG = await convertGraphToSVGNodes(graph, embedImages, bounds);

  // Combine everything into final SVG
  const svg = `<svg 
    width="${svgWidth}" 
    height="${svgHeight}" 
    viewBox="${bounds.minX.toFixed(1)} ${bounds.minY.toFixed(1)} ${(
    bounds.width + bounds.minX
  ).toFixed(1)} ${(bounds.height + bounds.minY).toFixed(1)}"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    style="font-family:Arial, sans-serif;"
  >
    ${
      backgroundColor !== "transparent"
        ? `<rect width="100%" height="100%" fill="${backgroundColor}" />`
        : ""
    }
    <g class="edges">
      ${edgesSVG}
    </g>
    <g class="labels">${defs ? `\n<defs>${defs}</defs>\n` : ""}
      ${labels}
    </g>
    <g class="nodes">
      ${nodesSVG}
    </g>
  </svg>`;

  return svg;
};

const calculateGraphBounds = (
  graph: GraphSVG,
  options: {
    padding?: number;
    labelFontSize?: number;
    averageCharWidth?: number;
    labelOffset?: number;
    edgeLabelSpace?: number;
  }
): Bounds => {
  const nodes = Object.values(graph.nodes);

  if (nodes.length === 0) {
    return { minX: 0, minY: 0, width: 100, height: 100 };
  }

  const {
    padding = 10,
    labelFontSize = 5,
    averageCharWidth = 0.6,
    labelOffset = 10,
    edgeLabelSpace = 3,
  } = options;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Calculate bounds for nodes including their visual elements
  nodes.forEach((node) => {
    // Node circle bounds
    const nodeMinX = node.x - node.size;
    const nodeMaxX = node.x + node.size;
    const nodeMinY = node.y - node.size;
    const nodeMaxY = node.y + node.size;

    // Label bounds (positioned to the right of the node in your SVG)
    if (node.label) {
      const labelWidth = node.label.length * labelFontSize * averageCharWidth;
      const labelX = node.x + labelOffset;
      const labelMaxX = labelX + labelWidth;

      minX = Math.min(minX, nodeMinX, labelX);
      maxX = Math.max(maxX, nodeMaxX, labelMaxX);
    } else {
      minX = Math.min(minX, nodeMinX);
      maxX = Math.max(maxX, nodeMaxX);
    }

    minY = Math.min(minY, nodeMinY);
    maxY = Math.max(maxY, nodeMaxY);
  });

  // Calculate bounds for edge labels
  graph.edges.forEach((edge) => {
    if (edge.label) {
      const sourceNode = graph.nodes[edge.source];
      const targetNode = graph.nodes[edge.target];

      if (sourceNode && targetNode) {
        // Estimate midpoint of edge
        const midX = (sourceNode.x + targetNode.x) / 2;
        const midY = (sourceNode.y + targetNode.y) / 2;

        // Estimate label dimensions
        const labelWidth = edge.label.length * labelFontSize * averageCharWidth;
        const labelHeight = labelFontSize;

        // Add some space around the label for curved text paths
        const labelMinX = midX - labelWidth / 2 - edgeLabelSpace;
        const labelMaxX = midX + labelWidth / 2 + edgeLabelSpace;
        const labelMinY = midY - labelHeight / 2 - edgeLabelSpace;
        const labelMaxY = midY + labelHeight / 2 + edgeLabelSpace;

        minX = Math.min(minX, labelMinX);
        maxX = Math.max(maxX, labelMaxX);
        minY = Math.min(minY, labelMinY);
        maxY = Math.max(maxY, labelMaxY);
      }
    }
  });

  // Account for edge thickness and curvature
  graph.edges.forEach((edge) => {
    const sourceNode = graph.nodes[edge.source];
    const targetNode = graph.nodes[edge.target];

    if (sourceNode && targetNode) {
      const edgeThickness = edge.size / 2;

      // For curved edges, add extra space
      if (edge.type.includes("curved")) {
        const dx = Math.abs(targetNode.x - sourceNode.x);
        const dy = Math.abs(targetNode.y - sourceNode.y);
        const curveOffset = Math.max(dx, dy) * 0.2; // Rough estimate for curve offset

        minX = Math.min(
          minX,
          Math.min(sourceNode.x, targetNode.x) - curveOffset - edgeThickness
        );
        maxX = Math.max(
          maxX,
          Math.max(sourceNode.x, targetNode.x) + curveOffset + edgeThickness
        );
        minY = Math.min(
          minY,
          Math.min(sourceNode.y, targetNode.y) - curveOffset - edgeThickness
        );
        maxY = Math.max(
          maxY,
          Math.max(sourceNode.y, targetNode.y) + curveOffset + edgeThickness
        );
      } else {
        // Straight edges
        minX = Math.min(
          minX,
          Math.min(sourceNode.x, targetNode.x) - edgeThickness
        );
        maxX = Math.max(
          maxX,
          Math.max(sourceNode.x, targetNode.x) + edgeThickness
        );
        minY = Math.min(
          minY,
          Math.min(sourceNode.y, targetNode.y) - edgeThickness
        );
        maxY = Math.max(
          maxY,
          Math.max(sourceNode.y, targetNode.y) + edgeThickness
        );
      }
    }
  });

  return {
    minX: minX - padding,
    minY: minY - padding,
    width: maxX - minX + 2 * padding,
    height: maxY - minY + 2 * padding,
  };
};

const estimateTextWidth = (text: string, fontSize: number): number => {
  // Rough estimation: average character width is about 0.6 * fontSize
  return text.length * fontSize * 0.6;
};

const convertGraphToSVGNodes = async (
  graph: GraphSVG,
  embedImages: boolean,
  bounds: Bounds
): Promise<string> => {
  const nodeElements: string[] = [];
  const embeddedImages = new Map<
    string,
    { id: string; content: string; viewBox: string }
  >();

  // First pass: collect and embed unique images
  if (embedImages) {
    const uniqueImages = new Set<string>();
    for (const node of Object.values(graph.nodes)) {
      if (node.image) {
        uniqueImages.add(node.image);
      }
    }

    // Fetch and embed unique images
    for (const imageUrl of uniqueImages) {
      try {
        const svgContent = await fetchSVGContent(imageUrl);
        if (svgContent) {
          const imageId = generateImageId(imageUrl);
          const imageData = cleanEmbeddedSVG(svgContent, imageId);
          embeddedImages.set(imageUrl, imageData);
        }
      } catch (error) {
        console.warn(`Failed to fetch image: ${imageUrl}`, error);
      }
    }
  }

  // Second pass: generate node elements
  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    const nodeElement = createNodeElement(
      node,
      nodeId,
      embeddedImages,
      embedImages,
      bounds
    );
    nodeElements.push(nodeElement);
  }

  // Combine defs and node elements
  let result = "";

  if (embeddedImages.size > 0) {
    result += "<defs>\n";
    for (const [_imageUrl, imageData] of embeddedImages) {
      result += imageData.content + "\n";
    }
    result += "</defs>\n";
  }

  result += nodeElements.join("\n");

  return result;
};

// Helper function to escape XML characters
const escapeXml = (text: string): string => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

// Updated createNodeElement function
const createNodeElement = (
  node: NodeSVG,
  nodeId: string,
  embeddedImages: Map<string, { id: string; content: string; viewBox: string }>,
  embedImages: boolean,
  bounds: Bounds
): string => {
  const { x, y, size, color = "#cccccc", image, label } = node;
  const imagePadding = size * 0.1; // 10% padding
  const imageSize = size * 0.8; // 80% of node size for image

  let nodeElement = `<g class="node" data-node-id="${nodeId}">`;

  // Add background circle
  nodeElement += `
    <circle 
      cx="${x}" 
      cy="${y}" 
      r="${size}" 
      fill="${color}" 
      stroke="none"
    />`;

  // Add image if present
  if (image) {
    if (embedImages && embeddedImages.has(image)) {
      // Use embedded image with proper scaling and centering
      const imageData = embeddedImages.get(image)!;

      // Calculate the square area for the image within the circle
      const imageAreaSize = imageSize * 2; // Diameter of the image area
      const imageAreaX = x - imageSize; // Center the square area
      const imageAreaY = y - imageSize;

      nodeElement += createImageUseElementForCircle(
        imageData,
        imageAreaX,
        imageAreaY,
        imageAreaSize,
        imageAreaSize,
        imagePadding
      );
    } else {
      // Use external image reference with proper aspect ratio preservation
      nodeElement += `
        <image 
          href="${image}" 
          x="${(x - imageSize).toFixed(1)}" 
          y="${(y - imageSize).toFixed(1)}" 
          width="${(imageSize * 2).toFixed(1)}" 
          height="${(imageSize * 2).toFixed(1)}"
          preserveAspectRatio="xMidYMid meet"
        />`;
    }
  }

  // Add label if present
  if (label) {
    // const fontSize = +Math.min(16, Math.max(5, size * 0.3)).toFixed(1);
    const fontSize = estimateSvgFontSize({
      label,
      availableWidth: 100,
      availableHeight: 20,
      viewBoxWidth: bounds.width,
      viewBoxHeight: bounds.height,
    });
    const labelX = x + size + 5; // 5px gap from node edge
    const labelY = y + fontSize / 3; // Slightly above center for better visual alignment

    nodeElement += `
      <text 
        x="${labelX.toFixed(1)}" 
        y="${labelY.toFixed(1)}" 
        font-size="${fontSize}" 
        fill="black"
        dominant-baseline="middle"
      >${escapeXml(label)}</text>`;
  }

  nodeElement += "</g>";
  return nodeElement;
};

// Specialized version for circular nodes
const createImageUseElementForCircle = (
  imageData: { id: string; content: string; viewBox: string },
  x: number,
  y: number,
  width: number,
  height: number,
  padding: number = 4
): string => {
  // Calculate available space for the image (with padding)
  const availableWidth = width - padding * 2;
  const availableHeight = height - padding * 2;

  // Parse the viewBox to get original aspect ratio
  const viewBoxParts = imageData.viewBox.split(" ").map((v) => parseFloat(v));
  const originalWidth = viewBoxParts[2] - viewBoxParts[0];
  const originalHeight = viewBoxParts[3] - viewBoxParts[1];
  const aspectRatio = originalWidth / originalHeight;

  // Calculate scaled dimensions maintaining aspect ratio
  let scaledWidth, scaledHeight;
  if (availableWidth / availableHeight > aspectRatio) {
    // Height is the limiting factor
    scaledHeight = availableHeight;
    scaledWidth = scaledHeight * aspectRatio;
  } else {
    // Width is the limiting factor
    scaledWidth = availableWidth;
    scaledHeight = scaledWidth / aspectRatio;
  }

  // Center the image within the available space
  const imageX = x + padding + (availableWidth - scaledWidth) / 2;
  const imageY = y + padding + (availableHeight - scaledHeight) / 2;

  return `<use href="#${imageData.id}" x="${imageX.toFixed(
    1
  )}" y="${imageY.toFixed(1)}" width="${scaledWidth.toFixed(
    1
  )}" height="${scaledHeight.toFixed(1)}"/>`;
};

const fetchSVGContent = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const content = await response.text();
    return content;
  } catch (error) {
    console.warn(`Failed to fetch SVG from ${url}:`, error);
    return null;
  }
};

const generateImageId = (url: string): string => {
  // Create a simple hash of the URL for the ID
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `img_${Math.abs(hash)}`;
};

const cleanEmbeddedSVG = (
  svgContent: string,
  newId: string
): { id: string; content: string; viewBox: string } => {
  // Extract viewBox and dimensions from the original SVG
  const svgMatch = svgContent.match(/<svg[^>]*>/);
  let viewBox = "0 0 100 100"; // Default fallback

  if (svgMatch) {
    const svgTag = svgMatch[0];

    // Try to extract viewBox
    const viewBoxMatch = svgTag.match(/viewBox=["']([^"']+)["']/);
    if (viewBoxMatch) {
      viewBox = viewBoxMatch[1];
    } else {
      // Try to extract width and height to create viewBox
      const widthMatch = svgTag.match(/width=["']?([^"'\s]+)["']?/);
      const heightMatch = svgTag.match(/height=["']?([^"'\s]+)["']?/);

      if (widthMatch && heightMatch) {
        const width = parseFloat(widthMatch[1]);
        const height = parseFloat(heightMatch[1]);
        if (!isNaN(width) && !isNaN(height)) {
          viewBox = `0 0 ${width} ${height}`;
        }
      }
    }
  }

  // Remove the SVG wrapper and extract inner content
  const innerContentMatch = svgContent.match(/<svg[^>]*>(.*)<\/svg>/s);
  const innerContent = innerContentMatch ? innerContentMatch[1] : svgContent;

  // Wrap in a symbol for better reusability and scaling
  const content = `<symbol id="${newId}" viewBox="${viewBox}">${innerContent}</symbol>`;

  return {
    id: newId,
    content: content,
    viewBox: viewBox,
  };
};

// Enhanced version that allows customization of node rendering
export const convertGraphToSVGAdvanced = async (
  graph: GraphSVG,
  options: {
    width?: number;
    height?: number;
    padding?: number;
    backgroundColor?: string;
    embedImages?: boolean;
    optimize?: boolean;
    nodeRenderer?: (node: NodeSVG, nodeId: string) => string;
    edgeRenderer?: (
      graph: GraphSVG,
      bounds: Bounds,
      optimize?: boolean
    ) => SVGResult;
  } = {}
): Promise<string> => {
  const {
    width = 800,
    height = 600,
    padding = 20,
    backgroundColor = "transparent",
    embedImages = true,
    optimize = true,
    nodeRenderer,
    edgeRenderer = convertGraphToSVGEdges,
  } = options;

  const bounds = calculateGraphBounds(graph, { padding });
  const svgWidth = width || bounds.width;
  const svgHeight = height || bounds.height;

  const { paths: edgesSVG, labels } = edgeRenderer(graph, bounds, optimize);

  let nodesSVG: string;
  if (nodeRenderer) {
    // Use custom node renderer
    const nodeElements = Object.entries(graph.nodes).map(([id, node]) =>
      nodeRenderer(node, id)
    );
    nodesSVG = nodeElements.join("\n");
  } else {
    // Use default node renderer
    nodesSVG = await convertGraphToSVGNodes(graph, embedImages, bounds);
  }

  const svg = `<svg 
    width="${svgWidth}" 
    height="${svgHeight}" 
    viewBox="${bounds.minX} ${bounds.minY} ${bounds.width + bounds.minX} ${
    bounds.height + bounds.minY
  }"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
  >
    ${
      backgroundColor !== "transparent"
        ? `<rect width="100%" height="100%" fill="${backgroundColor}" />`
        : ""
    }
    <g class="edges">
      ${edgesSVG}
    </g>
    <g class="labels">
      ${labels}
    </g>
    <g class="nodes">
      ${nodesSVG}
    </g>
  </svg>`;
  console.log(svg);
  return svg;
};
