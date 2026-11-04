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
};

export default config;
