import type { Config } from 'jest';
import { createCjsPreset } from 'jest-preset-angular/presets/index.js';

const preset = createCjsPreset({ tsconfig: '<rootDir>/tsconfig.spec.json' });

const config: Config = {
  ...preset,
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  clearMocks: true,
};

export default config;
