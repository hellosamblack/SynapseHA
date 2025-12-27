import type { Entity, Area, Device } from '../types';

export class NameResolver {
  private nameIndex: Map<string, string[]> = new Map();
  private entities: Map<string, Entity> = new Map();
  private areas: Map<string, Area> = new Map();
  private devices: Map<string, Device> = new Map();

  normalizeName(name: string): string {
    if (name == null || typeof name !== 'string') return '';
    return String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  setEntities(entities: Entity[]): void {
    this.entities.clear();
    this.nameIndex.clear();

    for (const entity of entities) {
      const id = entity.entity_id;
      this.entities.set(id, entity);

      // Index by friendly name
      const friendlyName = entity.attributes?.friendly_name || id.split('.').slice(1).join(' ');
      const normalized = this.normalizeName(friendlyName);
      
      if (!this.nameIndex.has(normalized)) {
        this.nameIndex.set(normalized, []);
      }
      this.nameIndex.get(normalized)!.push(id);

      // Also index by entity_id normalized
      const idNorm = this.normalizeName(id.replace('.', ' '));
      if (!this.nameIndex.has(idNorm)) {
        this.nameIndex.set(idNorm, []);
      }
      this.nameIndex.get(idNorm)!.push(id);
    }
  }

  setAreas(areas: Area[]): void {
    this.areas.clear();
    for (const area of areas) {
      this.areas.set(area.area_id, area);
    }
  }

  setDevices(devices: Device[]): void {
    this.devices.clear();
    for (const device of devices) {
      this.devices.set(device.id, device);
    }
  }

  resolveEntityId(args: {
    entity_id?: string;
    name?: string;
    area?: string;
    floor?: string;
    domain?: string;
  }): string | null {
    // Direct entity_id takes precedence
    if (args.entity_id) {
      return args.entity_id;
    }

    if (!args.name) {
      return null;
    }

    const searchName = args.name;
    const normalized = this.normalizeName(searchName);
    let candidates = this.nameIndex.get(normalized) || [];

    // Try partial matches if no exact match
    if (candidates.length === 0) {
      const partialMatches: string[] = [];
      for (const [key, entityIds] of this.nameIndex.entries()) {
        if (key.includes(normalized) || normalized.includes(key)) {
          partialMatches.push(...entityIds);
        }
      }
      candidates = [...new Set(partialMatches)];
    }

    if (candidates.length === 0) {
      return null;
    }

    if (candidates.length === 1) {
      return candidates[0];
    }

    // Disambiguation logic
    let filtered = candidates;

    // Prefer exact domain match
    if (args.domain) {
      const domainMatches = filtered.filter(c => c.startsWith(`${args.domain}.`));
      if (domainMatches.length > 0) {
        filtered = domainMatches;
      }
    }

    // Filter by area if provided
    if (args.area && filtered.length > 1) {
      const areaFiltered = filtered.filter(entityId => {
        const entity = this.entities.get(entityId);
        const entityAreaId = entity?.attributes?.area_id;
        if (!entityAreaId) return false;
        
        const areaObj = this.areas.get(entityAreaId);
        return areaObj && this.normalizeName(areaObj.name) === this.normalizeName(args.area!);
      });
      
      if (areaFiltered.length > 0) {
        filtered = areaFiltered;
      }
    }

    // Filter by floor if provided
    if (args.floor && filtered.length > 1) {
      const floorFiltered = filtered.filter(entityId => {
        const entity = this.entities.get(entityId);
        return entity?.attributes?.floor === args.floor;
      });
      
      if (floorFiltered.length > 0) {
        filtered = floorFiltered;
      }
    }

    // Return best match
    return filtered[0] || null;
  }

  getEntity(entityId: string): Entity | undefined {
    return this.entities.get(entityId);
  }

  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }
}
