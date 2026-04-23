'use strict';

const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

/** @type {import('webpack').Configuration} */
const nodeConfig = {
  target: 'node',
  entry: {
    extension: './src/extension.ts',
    server: './src/language-server/server.ts',
    'test/runTests': './src/test/runTests.ts',
    'test/suite/index': './src/test/suite/index.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs2',
  },
  externals: {
    vscode: 'commonjs vscode',
    '@vscode/test-electron': 'commonjs @vscode/test-electron',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: 'ts-loader',
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'node_modules/web-tree-sitter/tree-sitter.wasm', to: '.' },
        { from: 'grammars/bsl/tree-sitter-bsl.wasm', to: '.' },
      ],
    }),
  ],
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: 'log',
  },
};

/** @type {import('webpack').Configuration} */
const webviewConfig = {
  target: 'web',
  entry: {
    formEditor: './src/formEditor/webview/formEditor.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(__dirname, 'src/formEditor/webview/tsconfig.json'),
          },
        },
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/formEditor/webview/styles.css', to: 'formEditor.css' },
      ],
    }),
  ],
  devtool: 'nosources-source-map',
};

module.exports = [nodeConfig, webviewConfig];
