import { describe, it, expect } from 'vitest';
import { generateAIPlaylist, generateDaylist, generateBlendPlaylist, smartShuffle } from '../utils/aiFeatures';

describe('aiFeatures', () => {
  const mockTracks = [
    { id: '1', title: 'Chill Vibes', artist: 'Lofi Girl', genre: 'lofi chill ambient' },
    { id: '2', title: 'Party Time', artist: 'DJ Pop', genre: 'pop upbeat dance' },
    { id: '3', title: 'Sad Song', artist: 'Indie Band', genre: 'indie acoustic sad' },
    { id: '4', title: 'Workout Anthem', artist: 'Rock Star', genre: 'rock upbeat hip-hop' },
    { id: '5', title: 'Morning Coffee', artist: 'Acoustic Guy', genre: 'acoustic chill pop' }
  ];

  describe('generateAIPlaylist', () => {
    it('returns empty array when prompt is empty or no tracks', () => {
      expect(generateAIPlaylist('', mockTracks)).toEqual([]);
      expect(generateAIPlaylist('chill', [])).toEqual([]);
      expect(generateAIPlaylist(null, null)).toEqual([]);
    });

    it('finds chill tracks based on prompt', () => {
      const result = generateAIPlaylist('I want some chill lofi beats', mockTracks);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].title).toBe('Chill Vibes'); // Should score highest
    });

    it('finds upbeat/party tracks based on prompt', () => {
      const result = generateAIPlaylist('time to party and dance', mockTracks);
      expect(result.length).toBeGreaterThan(0);
      expect(result.some(t => t.id === '2')).toBe(true);
    });
  });

  describe('generateDaylist', () => {
    it('returns morning tracks at 8 AM', () => {
      const result = generateDaylist(mockTracks, 8);
      // Morning targets: upbeat, pop, acoustic
      expect(result.some(t => t.id === '2' || t.id === '5' || t.id === '4')).toBe(true);
    });

    it('returns evening tracks at 18 PM', () => {
      const result = generateDaylist(mockTracks, 18);
      // Evening targets: r&b, jazz, indie, chill
      expect(result.some(t => t.id === '3' || t.id === '1' || t.id === '5')).toBe(true);
    });
  });

  describe('smartShuffle', () => {
    it('interleaves recommended tracks based on genre', () => {
      const currentPlaylist = [ mockTracks[0] ]; // lofi chill
      const result = smartShuffle(currentPlaylist, mockTracks);
      
      // Should have original track plus potentially a recommendation
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].id).toBe('1');
    });
  });
});
