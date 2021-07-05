const webpack = require("webpack");
const webpackProd = require("./webpack.config");

module.exports = {
  ...webpackProd,
  mode: "development",
  devtool: "eval-source-map",
  entry: {
    index: ["webpack-hot-middleware/client", "./index.scss", "./index.js"],
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    // Use NoErrorsPlugin for webpack 1.x
    new webpack.NoEmitOnErrorsPlugin(),
    ...webpackProd.plugins,
  ],
};
