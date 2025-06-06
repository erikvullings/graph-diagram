import path, { resolve } from "path";
import * as core from "@rspack/core";
const devMode = (process.env as any).NODE_ENV === "development";
const isProduction = !devMode;
const outputPath = resolve(process.cwd(), isProduction ? "./docs" : "dist");
const SERVER = process.env.SERVER || "localhost";
const publicPath = isProduction
  ? "https://erikvullings.github.io/graph-diagram/"
  : "";
const APP_TITLE = "Graph Diagram Editor";
const APP_DESC =
  "A mermaid-like playground converting plain text to graph diagrams with nodes and edges.";
const APP_PORT = 3499;

console.log(
  `Running in ${
    isProduction ? "production" : "development"
  } mode, serving from ${SERVER}:${APP_PORT} and public path ${publicPath}, output directed to ${outputPath}.`
);

const configuration: core.Configuration = {
  experiments: {
    css: true,
    // asyncWebAssembly: true,
  },
  mode: isProduction ? "production" : "development",
  entry: {
    main: "./src/index.ts",
  },
  devServer: {
    port: APP_PORT,
  },
  devtool: devMode ? "inline-source-map" : "source-map",
  plugins: [
    new core.SourceMapDevToolPlugin({
      test: /\.ts$/,
      filename: "[file].map[query]",
    }),
    new core.DefinePlugin({
      "process.env.SERVER": isProduction
        ? `'${publicPath}'`
        : "`http://localhost:${APP_PORT}`",
    }),
    new core.HtmlRspackPlugin({
      title: APP_TITLE,
      publicPath,
      scriptLoading: "defer",
      minify: !devMode,
      favicon: "./src/favicon.ico",
      meta: {
        viewport: "width=device-width, initial-scale=1",
        "Content-Security-Policy": {
          "http-equiv": "Permissions-Policy",
          content: "interest-cohort=(), user-id=()",
        },
        "og:title": APP_TITLE,
        "og:description": APP_DESC,
        "og:url": SERVER || "",
        "og:site_name": APP_TITLE,
        "og:image:alt": APP_TITLE,
        "og:image": "./src/assets/logo.svg",
        "og:image:type": "image/svg",
        "og:image:width": "200",
        "og:image:height": "200",
      },
    }),
    new core.HotModuleReplacementPlugin(),
    new core.LightningCssMinimizerRspackPlugin(),
    new core.SwcJsMinimizerRspackPlugin({
      minimizerOptions: {
        compress: isProduction,
        minify: isProduction,
        mangle: isProduction,
      },
    }),
  ],
  resolve: {
    extensions: ["...", ".ts", "*.wasm", "*.csv", "*.json"], // "..." means to extend from the default extensions
    tsConfig: path.resolve(process.cwd(), "tsconfig.json"),
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/],
        loader: "builtin:swc-loader",
        /** @type {import('@rspack/core').SwcLoaderOptions} */
        options: {
          jsc: {
            parser: {
              syntax: "typescript",
            },
          },
        },
        type: "javascript/auto",
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif|webp)$/i,
        type: "asset/resource",
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: "asset/resource",
      },
      {
        test: /^BUILD_ID$/,
        type: "asset/source",
      },
      {
        test: /\.scss$/,
        use: [
          {
            loader: "sass-loader",
            options: {
              sassOptions: {
                modifyVars: {
                  // Options
                },
                javascriptEnabled: true,
              },
            },
          },
        ],
        type: "css", // This is must, which tells rspack this is type of css resources
      },
    ],
  },
  optimization: {
    minimize: isProduction,
    minimizer: [],
  },
  output: {
    filename: "[id].bundle.js",
    publicPath,
    path: outputPath,
  },
};

export default configuration;
