import person from "../assets/person.svg";
import company from "../assets/company.svg";
import location from "../assets/location.svg";
import document from "../assets/document.svg";
import concept from "../assets/concept.svg";
import message from "../assets/message.svg";
import group from "../assets/group.svg";
import tag from "../assets/tag.svg";
import book from "../assets/book.svg";
import education from "../assets/education.svg";

export type NodeType =
  | "node"
  | "person"
  | "group"
  | "tag"
  | "message"
  | "location"
  | "document"
  | "book"
  | "education"
  | "company"
  | "concept";

export class GraphParser {
  nodes: Map<string, any>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label: string;
    size: number;
    type: "arrow" | "line";
  }>;
  title = "Graph Diagram";
  nodeNames =
    /node|person|group|tag|message|location|document|company|concept|book|education/i;

  constructor() {
    this.nodes = new Map();
    this.edges = [];
  }

  parse(text: string) {
    this.nodes.clear();
    this.edges = [];

    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//"));

    for (const line of lines) {
      if (line.startsWith("graphDiagram")) {
        this.parseTitle(line);
      } else if (this.nodeNames.test(line)) {
        this.parseNode(line);
      } else if (this.isEdgeLine(line)) {
        this.parseEdge(line);
      }
    }

    return {
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      title: this.title,
    };
  }

  nodeTypeToImage(nodeType: NodeType): string | undefined {
    switch (nodeType.toLowerCase()) {
      case "node":
        return undefined;
      case "person":
        return person;
      case "group":
        return group;
      case "tag":
        return tag;
      case "message":
        return message;
      case "concept":
        return concept;
      case "company":
        return company;
      case "location":
        return location;
      case "document":
        return document;
      case "book":
        return book;
      case "education":
        return education;
    }
  }

  parseTitle(line: string) {
    const parts = line.replace("graphDiagram", "").trim();
    if (parts) this.title = parts;
  }

  parseNode(line: string) {
    const parts = line.trim().split(/\s+/);
    const nodeType = parts[0].toLowerCase() as NodeType;
    const label = parts[1];
    let size = 10;
    let color = "#666";

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith("#")) {
        // Handle named colors like #red, #blue, etc.
        const namedColors: Record<string, string> = {
          "#red": "#ff0000",
          "#green": "#00ff00",
          "#blue": "#0000ff",
          "#yellow": "#ffff00",
          "#orange": "#ffa500",
          "#purple": "#800080",
          "#pink": "#ffc0cb",
          "#cyan": "#00ffff",
          "#magenta": "#ff00ff",
          "#lime": "#00ff00",
          "#brown": "#a52a2a",
          "#gray": "#808080",
          "#grey": "#808080",
          "#black": "#000000",
          "#white": "#ffffff",
          "#lightgreen": "#90ee90",
          "#lightblue": "#add8e6",
          "#lightred": "#ffcccb",
        };
        color = namedColors[part.toLowerCase()] || part;
      } else if (!isNaN(parseInt(part))) {
        size = parseInt(part);
      }
    }

    console.log(
      `${nodeType} ${label} position and image: ${this.nodeTypeToImage(
        nodeType
      )}`
    );

    this.nodes.set(label, {
      id: label,
      label,
      size,
      color,
      image: this.nodeTypeToImage(nodeType),
    });
  }

  isEdgeLine(line: string) {
    return line.includes("->") || line.includes("<-") || line.includes("--");
  }

  parseEdge(line: string) {
    let source,
      target,
      label = "",
      weight = 1,
      directed = false;

    // Split by colon to separate edge definition from label
    const [edgePart, ...labelParts] = line.split(":");
    label = labelParts.join(":").trim();

    // Parse edge patterns
    if (edgePart.includes("->")) {
      directed = true;
      const match = edgePart.match(/(.+?)-(\d+)?->(.+)/);
      if (match) {
        source = match[1].trim();
        weight = match[2] ? parseInt(match[2]) : 1;
        target = match[3].trim();
      } else {
        const simplMatch = edgePart.split("->");
        source = simplMatch[0].trim();
        target = simplMatch[1].trim();
      }
    } else if (edgePart.includes("<-")) {
      directed = true;
      const match = edgePart.match(/(.+?)<(\d+)?-(.+)/);
      if (match) {
        target = match[1].trim();
        weight = match[2] ? parseInt(match[2]) : 1;
        source = match[3].trim();
      } else {
        const simplMatch = edgePart.split("<-");
        target = simplMatch[0].trim();
        source = simplMatch[1].trim();
      }
    } else if (edgePart.includes("--")) {
      const match = edgePart.match(/(.+?)-(\d+)?-(.+)/);
      if (match) {
        source = match[1].trim();
        weight = match[2] ? parseInt(match[2]) : 1;
        target = match[3].trim();
      } else {
        const simplMatch = edgePart.split("--");
        source = simplMatch[0].trim();
        target = simplMatch[1].trim();
      }
    }

    // Ensure nodes exist
    if (source && target) {
      if (!this.nodes.has(source)) {
        this.nodes.set(source, {
          id: source,
          label: source,
          size: 10,
          color: "#666",
        });
      }
      if (!this.nodes.has(target)) {
        this.nodes.set(target, {
          id: target,
          label: target,
          size: 10,
          color: "#666",
        });
      }

      this.edges.push({
        id: `${source}-${target}`,
        source,
        target,
        label,
        size: weight,
        type: directed ? "arrow" : "line",
      });
    }
  }
}
