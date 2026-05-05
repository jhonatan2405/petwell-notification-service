/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      // Ignorar errores de tipo pre-existentes en el código fuente.
      // Los tests sí quedan tipados correctamente.
      diagnostics: {
        ignoreCodes: ['TS2739', 'TS2345', 'TS2322'],
      },
    },
  },
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/helpers/setup.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    // Excluidos: infraestructura / tipos / arranque
    '!src/server.ts',
    '!src/config/**/*.ts',
    '!src/models/**/*.ts',
    '!src/repositories/**/*.ts',      // mockeado externamente, sin lógica propia
    '!src/services/scheduler.service.ts',
    '!src/services/email.service.ts',  // servicio externo (nodemailer)
  ],
  coverageThreshold: {
    global: {
      lines: 75,
      functions: 80,
      branches: 50,
      statements: 75,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  testTimeout: 10000,
};
