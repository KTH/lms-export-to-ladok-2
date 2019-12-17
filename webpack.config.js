const path = require('path')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

module.exports = {
  mode: process.env.NODE_ENV || 'production',
  context: path.resolve(__dirname, 'client'),
  entry: {
    index: ['./index.scss', './index.js']
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: `${process.env.PROXY_PATH}/dist/`
  },
  module: {
    rules: [
      { test: /\.js$/, exclude: /node_modules/, loader: 'babel-loader' },
      {
        test: /\.svg$/,
        loader: 'url-loader'
      },
      {
        test: /.s[ac]ss$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              hmr: process.env.NODE_ENV === 'development'
            }
          },
          'css-loader',
          {
            loader: 'resolve-url-loader',
            options: {
              join: function outerJoin (filename, options) {
                return function innerJoin (uri, baseOrIteratorOrAbsent) {
                  if (uri.includes('kth-style')) {
                    uri = `node_modules/kth-style/public${uri.slice(2)}`
                  }
                  return uri
                }
              }
            }
          },
          {
            loader: 'sass-loader',
            options: {
              sourceMap: true
            }
          }
        ]
      }
    ]
  },
  plugins: [new MiniCssExtractPlugin()]
}
