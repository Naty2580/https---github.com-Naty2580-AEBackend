import { jest } from '@jest/globals';
import { mockDeep, mockReset } from 'jest-mock-extended';

// Mock Prisma for unit/integration testing without hitting a real DB
export const prismaMock = mockDeep();

jest.mock('../src/infrastructure/database/prisma.client.js', () => ({
  __esModule: true,
  default: prismaMock,
}));

beforeEach(() => {
  mockReset(prismaMock);
});