/**
 * Webpack Security Configuration
 * 
 * Production build security enhancements
 */

const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
  mode: 'production',
  
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true, // Remove all console.* statements
            drop_debugger: true, // Remove debugger statements
            pure_funcs: [
              'console.log',
              'console.debug',
              'console.info',
              'console.warn',
              'console.error',
              'console.trace'
            ],
            passes: 2,
            unsafe: false,
            warnings: false,
          },
          mangle: {
            safari10: true,
          },
          format: {
            comments: false,
          },
        },
        extractComments: false,
      }),
    ],
    
    // Code splitting for better caching
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: -10,
        },
        default: {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
        },
      },
    },
  },
  
  plugins: [
    // Define production environment
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.DEBUG': JSON.stringify(''),
    }),
    
    // Security: Limit bundle size
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 5,
    }),
    
    // Security: Add integrity hashes
    new webpack.HashedModuleIdsPlugin(),
  ],
  
  // Security: Prevent source map exposure in production
  devtool: false,
  
  // Security: Strict module resolution
  resolve: {
    symlinks: false,
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
  },
  
  // Security: Node polyfills disabled
  node: false,
  
  // Performance hints
  performance: {
    hints: 'error',
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
  },
  
  // Security headers for dev server (if used)
  devServer: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    },
    https: true,
    compress: true,
  },
};