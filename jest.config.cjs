/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Override for Jest: allow JS, use commonjs
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        target: 'ES2020',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        jsx: 'react-jsx',
        strict: true,
        skipLibCheck: true,
        noEmit: false,
        baseUrl: '.',
        paths: {
          '@/*': ['src/*']
        },
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: [],
  // Ignore node_modules
  transformIgnorePatterns: [
    '/node_modules/(?!(@testing-library)/)',
  ],
};
