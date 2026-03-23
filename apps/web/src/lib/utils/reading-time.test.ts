import { describe, it, expect } from 'vitest';
import { calculateReadingTime } from './reading-time';

describe('calculateReadingTime', () => {
  it('should return 1 for short text', () => {
    const text = 'Hello world';
    expect(calculateReadingTime(text)).toBe(1);
  });

  it('should calculate correctly for longer text', () => {
    // 200 words per minute average
    const words = new Array(400).fill('word').join(' ');
    expect(calculateReadingTime(words)).toBe(2);
  });

  it('should handle empty string', () => {
    expect(calculateReadingTime('')).toBe(1);
  });
});
