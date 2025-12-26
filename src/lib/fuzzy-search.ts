import Fuse from 'fuse.js';
import type { Entity, Device, Area } from '../types';

export interface SearchResult<T> {
  item: T;
  score: number;
}

export class FuzzySearcher {
  private entityFuse: Fuse<Entity> | null = null;
  private deviceFuse: Fuse<Device> | null = null;
  private areaFuse: Fuse<Area> | null = null;

  setEntities(entities: Entity[]): void {
    this.entityFuse = new Fuse(entities, {
      keys: [
        { name: 'entity_id', weight: 0.7 },
        { name: 'attributes.friendly_name', weight: 0.3 },
      ],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true,
      useExtendedSearch: true,
    });
  }

  setDevices(devices: Device[]): void {
    this.deviceFuse = new Fuse(devices, {
      keys: [
        { name: 'name', weight: 0.5 },
        { name: 'name_by_user', weight: 0.5 },
      ],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true,
    });
  }

  setAreas(areas: Area[]): void {
    this.areaFuse = new Fuse(areas, {
      keys: ['name'],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true,
    });
  }

  searchEntities(query: string, limit: number = 10): SearchResult<Entity>[] {
    if (!this.entityFuse) return [];

    const results = this.entityFuse.search(query, { limit });
    return results.map(result => ({
      item: result.item,
      score: result.score || 0,
    }));
  }

  searchDevices(query: string, limit: number = 10): SearchResult<Device>[] {
    if (!this.deviceFuse) return [];

    const results = this.deviceFuse.search(query, { limit });
    return results.map(result => ({
      item: result.item,
      score: result.score || 0,
    }));
  }

  searchAreas(query: string, limit: number = 10): SearchResult<Area>[] {
    if (!this.areaFuse) return [];

    const results = this.areaFuse.search(query, { limit });
    return results.map(result => ({
      item: result.item,
      score: result.score || 0,
    }));
  }

  findEntityByName(name: string): Entity | null {
    const results = this.searchEntities(name, 1);
    return results.length > 0 ? results[0].item : null;
  }

  findDeviceByName(name: string): Device | null {
    const results = this.searchDevices(name, 1);
    return results.length > 0 ? results[0].item : null;
  }

  findAreaByName(name: string): Area | null {
    const results = this.searchAreas(name, 1);
    return results.length > 0 ? results[0].item : null;
  }

  getEntityByDomain(domain: string, entities?: Entity[]): Entity[] {
    if (entities) {
      return entities.filter(e => e.entity_id.startsWith(`${domain}.`));
    }
    return [];
  }
}
