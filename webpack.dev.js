const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const path = require("path");

module.exports = merge(common, {
  mode: "development",
  devtool: "source-map",
  devServer: {
    static: [
      // Specific paths first - order matters!
      {
        directory: path.join(__dirname, "src", "model"),
        publicPath: "/model",
      },
      {
        directory: path.join(__dirname, "src", "public"),
        publicPath: "/",
      },
      {
        directory: path.join(__dirname, "src"),
        publicPath: "/src",
      },
      // Fallback - only for built files in dist
      {
        directory: path.join(__dirname, "dist"),
      },
    ],
    compress: true,
    port: 4173,
    hot: true,
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
    },
    historyApiFallback: true,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    setupMiddlewares: (middlewares, devServer) => {
      devServer.app.get("*.bin", (req, res, next) => {
        res.setHeader("Content-Type", "application/octet-stream");
        next();
      });
      devServer.app.get("*.wasm", (req, res, next) => {
        res.setHeader("Content-Type", "application/wasm");
        next();
      });
      return middlewares;
    },
  },
});
