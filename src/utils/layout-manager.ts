import Graph from "graphology";
import { simpleForceLayout } from "./simple-force-layout";
import layoutForceAtlas2 from "graphology-layout-forceatlas2";

export type LayoutType =
  | "random"
  | "circular"
  | "simple-force"
  | "force-atlas2";

// Layout algorithms
export class LayoutManager {
  static applyLayout(graph: Graph, layoutType: LayoutType) {
    const nodes = graph.nodes();
    console.log(layoutType);
    switch (layoutType) {
      case "random":
        nodes.forEach((node) => {
          graph.setNodeAttribute(node, "x", (Math.random() - 0.5) * 400);
          graph.setNodeAttribute(node, "y", (Math.random() - 0.5) * 400);
        });
        break;

      case "circular":
        const angleStep = (2 * Math.PI) / nodes.length;
        const radius = Math.max(80, nodes.length * 20);
        nodes.forEach((node, i) => {
          const angle = i * angleStep;
          graph.setNodeAttribute(node, "x", Math.cos(angle) * radius);
          graph.setNodeAttribute(node, "y", Math.sin(angle) * radius);
        });
        break;

      case "simple-force":
        simpleForceLayout(graph, 50);
        break;

      case "force-atlas2":
        if (typeof layoutForceAtlas2 !== "undefined") {
          // Initialize positions first
          nodes.forEach((node) => {
            if (!graph.hasNodeAttribute(node, "x")) {
              graph.setNodeAttribute(node, "x", Math.random() * 200 - 100);
            }
            if (!graph.hasNodeAttribute(node, "y")) {
              graph.setNodeAttribute(node, "y", Math.random() * 200 - 100);
            }
          });

          const settings = layoutForceAtlas2.inferSettings(graph);
          layoutForceAtlas2.assign(graph, { iterations: 50, settings });
        } else {
          // Fallback to simple force
          simpleForceLayout(graph, 50);
        }
        break;
    }
  }
}
