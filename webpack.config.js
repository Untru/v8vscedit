'use strict';

const path = require('path');

/** @type {import('webpack').Configuration} */
module.exports = {
  target: 'node',
  mode: 'development',
  entry: {
    extension: './src/extension.ts',
    'test/runTests': './src/test/runTests.ts',
    'cli/onec-tools': './src/cli/onec-tools.ts',
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
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: 'log',
  },
};
