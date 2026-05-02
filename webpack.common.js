const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: {
    app: path.resolve(__dirname, "src/scripts/index.js"),
  },
  output: {
    filename: "[name].bundle.js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
  },
  resolve: {
    fallback: {
      fs: false,
      path: false,
      crypto: false,
      buffer: false,
      stream: false,
      os: false,
      url: false,
    },
    alias: {
      sharp$: false,
      "onnxruntime-node$": false,
      "onnxruntime-common": path.resolve(
        __dirname,
        "node_modules/onnxruntime-web/dist/ort.bundle.min.mjs",
      ),
    },
    extensions: [".js", ".mjs", ".json"],
  },
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif|ico)$/i,
        type: "asset/resource",
      },
      {
        test: /\.(wasm|bin)$/,
        type: "asset/resource",
      },
      {
        test: /\.mjs$/,
        include: /node_modules/,
        type: "javascript/auto",
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
    ],
    parser: {
      javascript: {
        importMeta: true,
      },
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/index.html"),
      scriptLoading: "module",
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, "src/public"),
          to: path.resolve(__dirname, "dist"),
        },
        {
          from: path.resolve(__dirname, "src/model"),
          to: path.resolve(__dirname, "dist/model"),
        },
      ],
    }),
  ],
  stats: {
    warningsFilter: /import\.meta/,
  },
};
