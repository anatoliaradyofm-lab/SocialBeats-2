describe('LRC Parser', () => {
  const parseLRC = (lrcText) => {
    if (!lrcText) return [];
    const lines = lrcText.split('\n');
    const parsed = [];
    for (const line of lines) {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const ms = parseInt(match[3].padEnd(3, '0'));
        const time = minutes * 60000 + seconds * 1000 + ms;
        const text = match[4].trim();
        if (text) parsed.push({ time, text });
      }
    }
    return parsed;
  };

  it('should parse LRC timestamps', () => {
    const lrc = '[00:15.20]First line\n[00:20.50]Second line';
    const result = parseLRC(lrc);
    expect(result).toHaveLength(2);
    expect(result[0].time).toBe(15200);
    expect(result[0].text).toBe('First line');
    expect(result[1].time).toBe(20500);
  });

  it('should skip lines without timestamps', () => {
    const lrc = '[ti:Song Title]\n[00:05.00]Lyrics here';
    const result = parseLRC(lrc);
    expect(result).toHaveLength(1);
  });

  it('should return empty for null input', () => {
    expect(parseLRC(null)).toEqual([]);
    expect(parseLRC('')).toEqual([]);
  });
});
