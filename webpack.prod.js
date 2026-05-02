const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const WorkboxWebpackPlugin = require("workbox-webpack-plugin");
const path = require("path");

module.exports = merge(common, {
  mode: "production",
  devtool: false,
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "assets/css/[name].[contenthash].css",
    }),
    new WorkboxWebpackPlugin.InjectManifest({
      swSrc: path.resolve(__dirname, "src/sw.js"),
      swDest: "sw.js",
      maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
      exclude: [/\.map$/],
    }),
  ],
  output: {
    filename: "assets/js/[name].[contenthash].bundle.js",
    path: path.resolve(__dirname, "dist"),
    clean: true,
  },
});
