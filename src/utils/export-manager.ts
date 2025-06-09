import Sigma from "sigma";
import Graph from "graphology";
import { downloadAsImage } from "@sigma/export-image";
import { convertGraphToSVG, EdgeSVG, NodeSVG } from "./svg-tools";
import { titleToFilename } from "./utils";

export class ExportManager {
  static async exportToPNG(sigma: Sigma, fileName = "graph") {
    fileName = titleToFilename(fileName, ".png");
    try {
      downloadAsImage(sigma, { fileName });
      console.log("PNG export completed");
    } catch (error: any) {
      console.error("PNG export failed:", error);
      alert("PNG export failed: " + error.message);
    }
  }

  static async exportToSVG(graph: Graph, filename = "graph") {
    filename = titleToFilename(filename, ".svg");

    const padding = 10;
    // Create SVG string
    const nodes = graph.nodes();
    const edges = graph.edges();
    // Calculate bounds
    let minX = Infinity,
      //   maxX = -Infinity,
      //   minY = Infinity,
      maxY = -Infinity;
    nodes.forEach((node) => {
      const x = graph.getNodeAttribute(node, "x");
      const y = graph.getNodeAttribute(node, "y");
      const size = graph.getNodeAttribute(node, "size") || 10;
      minX = Math.min(minX, x - size);
      // maxX = Math.max(maxX, x + size);
      // minY = Math.min(minY, y - size);
      maxY = Math.max(maxY, y + size);
    });

    // const width = maxX - minX + 40;
    // const height = maxY - minY + 40;

    const svgNodes: { [key: string]: NodeSVG } = {};
    const svgEdges: EdgeSVG[] = [];

    nodes.forEach((node) => {
      const x = +(graph.getNodeAttribute(node, "x") - minX + padding).toFixed(
        1
      );
      const y = +(maxY - graph.getNodeAttribute(node, "y") + padding).toFixed(
        1
      );
      const size = +(graph.getNodeAttribute(node, "size") / 5).toFixed(1) || 2;
      const label = graph.getNodeAttribute(node, "label");
      const color = graph.getNodeAttribute(node, "color");
      const image = graph.getNodeAttribute(node, "image");
      svgNodes[node] = { x, y, size, label, color, image };
    });
    edges.forEach((edge) => {
      const source = graph.source(edge);
      const target = graph.target(edge);
      const label = graph.getEdgeAttribute(edge, "label") || "";
      const size = +(graph.getEdgeAttribute(edge, "size") / 5).toFixed(1) || 1;
      const type = graph.getEdgeAttribute(edge, "type") || "line";
      const color = graph.getEdgeAttribute(edge, "color");
      svgEdges.push({ source, target, label, color, size, type });
    });

    const svg = await convertGraphToSVG({ nodes: svgNodes, edges: svgEdges });
    console.log(svg);
    // Download
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
