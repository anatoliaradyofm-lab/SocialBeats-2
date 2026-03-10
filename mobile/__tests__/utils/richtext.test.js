import React from 'react';

describe('RichText parsing', () => {
  const COMBINED_REGEX = /(@\w+|#\w+|https?:\/\/[^\s]+)/g;

  it('should parse mentions', () => {
    const text = 'Hello @user1 how are you?';
    const matches = text.match(COMBINED_REGEX);
    expect(matches).toEqual(['@user1']);
  });

  it('should parse hashtags', () => {
    const text = 'Check #music and #socialbeats';
    const matches = text.match(COMBINED_REGEX);
    expect(matches).toEqual(['#music', '#socialbeats']);
  });

  it('should parse URLs', () => {
    const text = 'Visit https://socialbeats.app for more';
    const matches = text.match(COMBINED_REGEX);
    expect(matches).toEqual(['https://socialbeats.app']);
  });

  it('should parse mixed content', () => {
    const text = '@john posted #music at https://example.com';
    const matches = text.match(COMBINED_REGEX);
    expect(matches).toEqual(['@john', '#music', 'https://example.com']);
  });

  it('should return null for plain text', () => {
    const text = 'Just a regular message';
    const matches = text.match(COMBINED_REGEX);
    expect(matches).toBeNull();
  });
});
