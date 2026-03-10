import api from '../../src/services/api';

describe('API Service', () => {
  it('should export get, post, put, delete methods', () => {
    expect(typeof api.get).toBe('function');
    expect(typeof api.post).toBe('function');
    expect(typeof api.put).toBe('function');
    expect(typeof api.delete).toBe('function');
  });
});
