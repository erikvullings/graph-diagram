import m, { FactoryComponent } from "mithril";
import * as monaco from "monaco-editor";
import Graph from "graphology";
import Sigma from "sigma";
import EdgeCurveProgram, { EdgeCurvedArrowProgram } from "@sigma/edge-curve";
import { createNodeImageProgram } from "@sigma/node-image";
import logo from "./assets/logo.svg";
import { GraphParser, LayoutManager, LayoutType } from "./utils";
import { ExportManager } from "./utils/export-manager";
import { debounce } from "./utils/index";

// @ts-ignore
self.MonacoEnvironment = {
  getWorker: function (moduleId, label) {
    console.log("Monaco Environment: ", label);
    if (label === "json") {
      return new Worker(
        new URL(
          "monaco-editor/esm/vs/language/json/json.worker",
          import.meta.url
        )
      );
    }
    if (label === "css" || label === "scss" || label === "less") {
      return new Worker(
        new URL("monaco-editor/esm/vs/language/css/css.worker", import.meta.url)
      );
    }
    if (label === "html" || label === "handlebars" || label === "razor") {
      return new Worker(
        new URL(
          "monaco-editor/esm/vs/language/html/html.worker",
          import.meta.url
        )
      );
    }
    if (label === "typescript" || label === "javascript") {
      return new Worker(
        new URL(
          "monaco-editor/esm/vs/language/typescript/ts.worker",
          import.meta.url
        )
      );
    }
    return new Worker(
      new URL("monaco-editor/esm/vs/editor/editor.worker", import.meta.url)
    );
  },
};

export const Playground: FactoryComponent<{}> = () => {
  let parser = new GraphParser();
  let sigma: Sigma;
  let graph: Graph;
  let selectedLayout: LayoutType = "simple-force";
  let edgeType: "line" | "curved" = "curved";
  let editorCollapsed = false;
  let editor: any;
  let sampleText = `graphDiagram The three amigos
    person Alice 25 #lightgreen
    node Bob 12 #lightblue
    node Charlie 8 #orange
    
    Alice->Bob: Hello Bob!
    Bob->Alice: Hi Alice!
    Alice-5->Charlie: How are you?
    Charlie--Bob: Good, thanks!`;
  let title: string;
  let hoveredNode: string | null = null;

  const initSigma = (dom: HTMLElement) => {
    const container = dom.querySelector("#sigma-container") as HTMLElement;
    graph = new Graph({ multi: false, type: "mixed" });

    // Configure Sigma with proper settings for visibility
    sigma = new Sigma(graph, container, {
      // Node rendering
      defaultNodeColor: "#ec5148",
      // defaultNodeType: "circle",
      defaultNodeType: "image",
      nodeProgramClasses: {
        image: createNodeImageProgram({ padding: 0.1 }),
      },
      // Edge rendering
      defaultEdgeColor: "#999",
      defaultEdgeType: edgeType,
      edgeProgramClasses: {
        curved: EdgeCurveProgram,
        curvedArrow: EdgeCurvedArrowProgram,
      },
      // Labels
      renderLabels: true,
      renderEdgeLabels: true,
      labelFont: "Arial",
      labelSize: 12,
      labelWeight: "normal",
      labelColor: { color: "#fff" },

      // Camera
      enableCameraRotation: false,

      // Performance
      hideEdgesOnMove: false,
      hideLabelsOnMove: false,

      // Interaction
      allowInvalidContainer: true,

      // Node reducer for hover effects
      nodeReducer: (node, data) => {
        const res = { ...data };

        if (hoveredNode && hoveredNode !== node) {
          // Check if this node is connected to the hovered node
          const isConnected =
            graph.hasEdge(hoveredNode, node) ||
            graph.hasEdge(node, hoveredNode);

          if (!isConnected) {
            res.color = "#333";
            res.label = "";
          }
        }

        return res;
      },

      // Edge reducer for hover effects
      edgeReducer: (edge, data) => {
        const res = { ...data };

        if (hoveredNode) {
          const source = graph.source(edge);
          const target = graph.target(edge);

          if (source !== hoveredNode && target !== hoveredNode) {
            res.color = "#333";
            res.label = "";
          }
        }

        return res;
      },
    });

    // Add hover event listeners
    sigma.on("enterNode", (event) => {
      hoveredNode = event.node;
      sigma.refresh();
    });

    sigma.on("leaveNode", () => {
      hoveredNode = null;
      sigma.refresh();
    });

    console.log("Sigma initialized:", sigma);
  };

  const updateGraph = () => {
    if (!editor || !sigma || !graph) return;

    try {
      const text = editor.getValue();
      const parsed = parser.parse(text);
      title = parsed.title;

      graph.clear();

      // Add nodes with temporary positions
      parsed.nodes.forEach((node) => {
        graph.addNode(node.id, {
          label: node.label,
          size: Math.max(5, node.size),
          color: node.color,
          x: Math.random() * 400 - 200, // Give random initial positions
          y: Math.random() * 400 - 200,
          image: node.image,
        });
      });

      // Add edges
      parsed.edges.forEach((edge) => {
        if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
          graph.addEdge(edge.source, edge.target, {
            label: edge.label || "",
            size: Math.max(1, edge.size),
            color: "#999",
            type:
              edgeType === "curved"
                ? edge.type === "arrow"
                  ? "curvedArrow"
                  : "curved"
                : edge.type === "arrow"
                ? "arrow"
                : "line",
          });
        }
      });

      console.log(
        "Graph created with",
        graph.order,
        "nodes and",
        graph.size,
        "edges"
      );

      // Apply selected layout AFTER nodes are added
      if (graph.order > 0) {
        console.log("Applying layout:", selectedLayout);
        LayoutManager.applyLayout(graph, selectedLayout);

        // Log node positions after layout
        graph.nodes().forEach((node) => {
          const x = graph.getNodeAttribute(node, "x");
          const y = graph.getNodeAttribute(node, "y");
          const image = graph.getNodeAttribute(node, "image");
          console.log(
            `Node ${node} position: (${x}, ${y}) and image: ${image}`
          );
        });
      }

      // Update sigma settings for edge type
      sigma.setSetting("defaultEdgeType", edgeType);

      // Refresh
      sigma.refresh();
      // sigma.render();

      // Fit to screen after a short delay to ensure layout is applied
      setTimeout(() => {
        fitToScreen();
      }, 200);
    } catch (error) {
      console.error("Error updating graph:", error);
    }
  };

  const changeLayout = (layout: LayoutType) => {
    selectedLayout = layout;
    console.log("Changing layout to:", layout);
    // this.selectedLayout = layout;

    // Apply the new layout immediately if we have nodes
    if (graph && graph.order > 0) {
      LayoutManager.applyLayout(graph, selectedLayout);

      // Log node positions after layout change
      graph.nodes().forEach((node) => {
        const x = graph.getNodeAttribute(node, "x");
        const y = graph.getNodeAttribute(node, "y");
        console.log(
          `After layout change - Node ${node} position: (${x}, ${y})`
        );
      });

      sigma.refresh();
      //sigma.render();

      // Fit to screen after layout change
      setTimeout(() => {
        fitToScreen();
      }, 100);
    }
  };

  const fitToScreen = () => {
    const camera = sigma.getCamera();
    camera.animatedReset(); // Reset to default position
  };

  const zoomIn = () => {
    const camera = sigma.getCamera();
    camera.animatedZoom();
  };

  const zoomOut = () => {
    const camera = sigma.getCamera();
    camera.animatedUnzoom();
  };

  const toggleEditor = () => {
    editorCollapsed = !editorCollapsed;
    setTimeout(() => {
      if (editor) {
        editor.layout();
      }
      if (sigma) {
        sigma.resize();
        sigma.refresh();
      }
    }, 300);
  };

  const changeEdgeType = (type: "line" | "curved") => {
    edgeType = type;
    updateGraph();
  };

  const exportPNG = () => {
    ExportManager.exportToPNG(sigma, title);
  };

  // const exportSVG = () => {
  //   ExportManager.exportToSVG(graph);
  // };

  return {
    oncreate({ dom }) {
      // Ensure libraries are loaded before initialization
      setTimeout(() => {
        // initMonaco(dom as HTMLElement);
        initSigma(dom as HTMLElement);
        // Give more time for initialization
        setTimeout(() => {
          updateGraph();
        }, 400);
      }, 100);
    },

    view() {
      return m("div.app-container", [
        m("div.header", [
          m("img", {
            width: "48px",
            src: logo,
            style: { marginRight: "10px" },
          }),
          m("h1", "Graph Diagram Editor"),
          m("div.header-controls", [
            m("div.control-group", [
              m("label", "Layout:"),
              m(
                "select.layout-select",
                {
                  value: selectedLayout,
                  onchange: (e: any) => changeLayout(e.target.value),
                },
                [
                  m("option", { value: "random" }, "Random layout"),
                  m("option", { value: "circular" }, "Circular layout"),
                  m("option", { value: "simple-force" }, "Force layout"),
                  m("option", { value: "force-atlas2" }, "Force Atlas 2"),
                ]
              ),
            ]),
            m("div.control-group", [
              m("label", "Curve:"),
              m(
                "select.layout-select",
                {
                  value: edgeType,
                  onchange: (e: any) => changeEdgeType(e.target.value),
                },
                [
                  m("option", { value: "line" }, "Line"),
                  m("option", { value: "curved" }, "Curve"),
                ]
              ),
            ]),
            m(
              "button.control-btn",
              {
                onclick: () => exportPNG(),
              },
              "PNG"
            ),
            // m(
            //   "button.control-btn",
            //   {
            //     onclick: () => exportSVG(),
            //   },
            //   "📄 SVG"
            // ),
            m(
              "button.toggle-btn",
              {
                onclick: () => toggleEditor(),
              },
              editorCollapsed ? "◀ Show Editor" : "▶ Hide Editor"
            ),
          ]),
        ]),
        m("div.main-content", [
          m(
            "div.editor-panel",
            {
              class: editorCollapsed ? "collapsed" : "",
            },
            [
              m("div.panel-header", [m("span", "Graph Definition")]),
              m("div#editor-container.editor-container", {
                oncreate: ({ dom }) => {
                  editor = monaco.editor.create(dom as HTMLElement, {
                    value: sampleText,
                    language: "plaintext",
                    theme: "vs-dark",
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                  });

                  editor.onDidChangeModelContent(() => {
                    debounce(updateGraph, 3000)();
                  });
                },
              }),
            ]
          ),
          m("div.graph-panel", [
            m("div.panel-header", [m("span", "Graph Visualization")]),
            m("div#sigma-container.sigma-container", [
              m("div.zoom-controls", [
                m(
                  "button.zoom-btn",
                  {
                    onclick: () => zoomIn(),
                    title: "Zoom In",
                  },
                  "+"
                ),
                m(
                  "button.zoom-btn",
                  {
                    onclick: () => zoomOut(),
                    title: "Zoom Out",
                  },
                  "−"
                ),
                m(
                  "button.zoom-btn",
                  {
                    onclick: () => fitToScreen(),
                    title: "Fit All",
                  },
                  "⛶"
                ),
              ]),
            ]),
          ]),
        ]),
      ]);
    },
  };
};
