import type { Config } from 'jest';
import { createCjsPreset } from 'jest-preset-angular/presets/index.js';

const preset = createCjsPreset({ tsconfig: '<rootDir>/tsconfig.spec.json' });

const config: Config = {
  ...preset,
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testEnvironment: 'jsdom',
  // Co-located specs: foo.ts is tested by foo.spec.ts next to it.
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/', '<rootDir>/.angular/'],
  // Spies created with jest.spyOn are restored between tests so they cannot leak.
  restoreMocks: true,
  clearMocks: true,

  // Coverage (run with: npm run test:coverage). Measures the application code only: specs, test
  // helpers, the bootstrap file and environment constants are excluded, because they either are
  // the tests or contain no logic worth measuring.
  collectCoverageFrom: [
    'src/app/**/*.ts',
    '!src/app/**/*.spec.ts',
    '!src/app/**/*.d.ts',
    '!src/app/**/store/testing.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'text', 'html', 'lcov'],
  // The build fails if coverage drops below these floors. They sit just under the current
  // numbers (99.6% statements, 93.5% branches, 100% functions, 99.6% lines) so a regression is
  // caught without making an unreachable null-fallback branch block a commit.
  coverageThreshold: {
    global: { statements: 97, branches: 90, functions: 98, lines: 97 },
    // Pure, side-effect-free code has no reason to be anything but fully covered.
    './src/app/shared/pipes/': { statements: 100, branches: 100, functions: 100, lines: 100 },
    './src/app/features/board/store/': { statements: 98, branches: 85, functions: 100, lines: 98 },
    './src/app/core/': { statements: 95, branches: 80, functions: 95, lines: 95 },
  },
};

export default config;
