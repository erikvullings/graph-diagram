import Graph from "graphology";

/// Simple force-directed layout implementation
export const simpleForceLayout = (graph: Graph, iterations = 50) => {
  const nodes = graph.nodes();
  const edges = graph.edges();

  // Initialize positions if not set
  nodes.forEach((node) => {
    if (!graph.hasNodeAttribute(node, "x")) {
      graph.setNodeAttribute(node, "x", Math.random() * 200 - 100);
    }
    if (!graph.hasNodeAttribute(node, "y")) {
      graph.setNodeAttribute(node, "y", Math.random() * 200 - 100);
    }
  });

  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map();

    // Initialize forces
    nodes.forEach((node) => {
      forces.set(node, { x: 0, y: 0 });
    });

    // Repulsive forces between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];

        const x1 = graph.getNodeAttribute(node1, "x");
        const y1 = graph.getNodeAttribute(node1, "y");
        const x2 = graph.getNodeAttribute(node2, "x");
        const y2 = graph.getNodeAttribute(node2, "y");

        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        const repulsiveForce = 1000 / (distance * distance);
        const fx = (dx / distance) * repulsiveForce;
        const fy = (dy / distance) * repulsiveForce;

        forces.get(node1).x -= fx;
        forces.get(node1).y -= fy;
        forces.get(node2).x += fx;
        forces.get(node2).y += fy;
      }
    }

    // Attractive forces for connected nodes
    edges.forEach((edge) => {
      const source = graph.source(edge);
      const target = graph.target(edge);

      const x1 = graph.getNodeAttribute(source, "x");
      const y1 = graph.getNodeAttribute(source, "y");
      const x2 = graph.getNodeAttribute(target, "x");
      const y2 = graph.getNodeAttribute(target, "y");

      const dx = x2 - x1;
      const dy = y2 - y1;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;

      const attractiveForce = distance * 0.01;
      const fx = (dx / distance) * attractiveForce;
      const fy = (dy / distance) * attractiveForce;

      forces.get(source).x += fx;
      forces.get(source).y += fy;
      forces.get(target).x -= fx;
      forces.get(target).y -= fy;
    });

    // Apply forces with damping
    const damping = 0.85;
    nodes.forEach((node) => {
      const force = forces.get(node);
      const currentX = graph.getNodeAttribute(node, "x");
      const currentY = graph.getNodeAttribute(node, "y");

      graph.setNodeAttribute(node, "x", currentX + force.x * damping);
      graph.setNodeAttribute(node, "y", currentY + force.y * damping);
    });
  }
};
