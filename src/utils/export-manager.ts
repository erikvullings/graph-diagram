import Sigma from "sigma";
import Graph from "graphology";
import { downloadAsImage } from "@sigma/export-image";

export class ExportManager {
  static async exportToPNG(sigma: Sigma, fileName = "graph") {
    try {
      downloadAsImage(sigma, { fileName });
      console.log("PNG export completed");
    } catch (error: any) {
      console.error("PNG export failed:", error);
      alert("PNG export failed: " + error.message);
    }
  }

  static async exportToSVG(graph: Graph, filename = "graph.svg") {
    // Create SVG string
    const nodes = graph.nodes();
    const edges = graph.edges();

    // Calculate bounds
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    nodes.forEach((node) => {
      const x = graph.getNodeAttribute(node, "x");
      const y = graph.getNodeAttribute(node, "y");
      const size = graph.getNodeAttribute(node, "size") || 10;
      minX = Math.min(minX, x - size);
      maxX = Math.max(maxX, x + size);
      minY = Math.min(minY, y - size);
      maxY = Math.max(maxY, y + size);
    });

    const width = maxX - minX + 40;
    const height = maxY - minY + 40;
    const offsetX = -minX + 20;
    const offsetY = -minY + 20;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    svg += '<rect width="100%" height="100%" fill="#1e1e1e"/>';

    // Add edges
    edges.forEach((edge) => {
      const source = graph.source(edge);
      const target = graph.target(edge);
      const x1 = graph.getNodeAttribute(source, "x") + offsetX;
      const y1 = graph.getNodeAttribute(source, "y") + offsetY;
      const x2 = graph.getNodeAttribute(target, "x") + offsetX;
      const y2 = graph.getNodeAttribute(target, "y") + offsetY;
      const color = graph.getEdgeAttribute(edge, "color") || "#999";

      svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2"/>`;

      // Add arrow for directed edges
      if (graph.getEdgeAttribute(edge, "type") === "arrow") {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const unitX = dx / length;
        const unitY = dy / length;
        const arrowX = x2 - unitX * 15;
        const arrowY = y2 - unitY * 15;
        const perpX = -unitY * 5;
        const perpY = unitX * 5;

        svg += `<polygon points="${x2},${y2} ${arrowX + perpX},${
          arrowY + perpY
        } ${arrowX - perpX},${arrowY - perpY}" fill="${color}"/>`;
      }
    });

    // Add nodes
    nodes.forEach((node) => {
      const x = graph.getNodeAttribute(node, "x") + offsetX;
      const y = graph.getNodeAttribute(node, "y") + offsetY;
      const size = graph.getNodeAttribute(node, "size") || 10;
      const color = graph.getNodeAttribute(node, "color") || "#ec5148";
      const label = graph.getNodeAttribute(node, "label") || node;

      svg += `<circle cx="${x}" cy="${y}" r="${size}" fill="${color}"/>`;
      svg += `<text x="${x}" y="${
        y + size + 15
      }" text-anchor="middle" fill="white" font-family="Arial" font-size="12">${label}</text>`;
    });

    svg += "</svg>";

    // Download
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
