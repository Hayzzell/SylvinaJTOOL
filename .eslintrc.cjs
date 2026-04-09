module.exports = {
  root: true,
  extends: ['react-app', 'react-app/jest'],
  ignorePatterns: ['build/', 'dist/', 'node_modules/'],
  overrides: [
    {
      files: ['tools/**/*.js'],
      env: {
        node: true
      },
      parserOptions: {
        sourceType: 'script'
      }
    }
  ]
};