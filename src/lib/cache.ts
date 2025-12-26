import fs from 'fs/promises';
import path from 'path';
import type { CachedData } from '../types';

export class CacheManager {
  private cacheDir: string;
  private cacheTTL: number;
  private memoryCache: Map<string, CachedData<any>>;
  private refreshCallbacks: Map<string, () => Promise<any>>;
  private refreshTimers: Map<string, NodeJS.Timeout>;

  constructor(cacheDir: string = './cache', cacheTTL: number = 60000) {
    this.cacheDir = cacheDir;
    this.cacheTTL = cacheTTL;
    this.memoryCache = new Map();
    this.refreshCallbacks = new Map();
    this.refreshTimers = new Map();
  }

  async init(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  private getCachePath(key: string): string {
    return path.join(this.cacheDir, `${key}.json`);
  }

  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryCached = this.memoryCache.get(key);
    if (memoryCached && Date.now() - memoryCached.timestamp < memoryCached.ttl) {
      return memoryCached.data as T;
    }

    // Check disk cache
    try {
      const cachePath = this.getCachePath(key);
      const data = await fs.readFile(cachePath, 'utf-8');
      const cached: CachedData<T> = JSON.parse(data);

      if (Date.now() - cached.timestamp < cached.ttl) {
        this.memoryCache.set(key, cached);
        return cached.data;
      }
    } catch (error) {
      // Cache miss or invalid cache
    }

    return null;
  }

  async set<T>(key: string, data: T, ttl: number = this.cacheTTL): Promise<void> {
    const cached: CachedData<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    // Update memory cache
    this.memoryCache.set(key, cached);

    // Update disk cache
    try {
      const cachePath = this.getCachePath(key);
      await fs.writeFile(cachePath, JSON.stringify(cached), 'utf-8');
    } catch (error) {
      console.error('Failed to write cache to disk:', error);
    }
  }

  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = this.cacheTTL
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetchFn();
    await this.set(key, data, ttl);
    return data;
  }

  registerAutoRefresh<T>(
    key: string,
    fetchFn: () => Promise<T>,
    interval: number = 60000
  ): void {
    // Store the callback
    this.refreshCallbacks.set(key, fetchFn);

    // Clear existing timer if any
    const existingTimer = this.refreshTimers.get(key);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Set up auto-refresh
    const timer = setInterval(async () => {
      try {
        const data = await fetchFn();
        await this.set(key, data, this.cacheTTL);
      } catch (error) {
        console.error(`Auto-refresh failed for key ${key}:`, error);
      }
    }, interval);

    this.refreshTimers.set(key, timer);
  }

  async invalidate(key: string): Promise<void> {
    this.memoryCache.delete(key);
    
    try {
      const cachePath = this.getCachePath(key);
      await fs.unlink(cachePath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
    
    // Clear all timers
    for (const timer of this.refreshTimers.values()) {
      clearInterval(timer);
    }
    this.refreshTimers.clear();
    this.refreshCallbacks.clear();

    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
    } catch (error) {
      console.error('Failed to clear cache directory:', error);
    }
  }

  shutdown(): void {
    for (const timer of this.refreshTimers.values()) {
      clearInterval(timer);
    }
    this.refreshTimers.clear();
  }
}
