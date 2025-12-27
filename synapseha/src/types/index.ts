export interface HomeAssistantConfig {
  url: string;
  token: string;
  cacheDir?: string;
  cacheTTL?: number;
}

export interface Entity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

export interface Service {
  domain: string;
  services: Record<string, ServiceDefinition>;
}

export interface ServiceDefinition {
  name: string;
  description: string;
  fields: Record<string, FieldDefinition>;
}

export interface FieldDefinition {
  name?: string;
  description: string;
  required?: boolean;
  example?: any;
  selector?: any;
}

export interface Device {
  id: string;
  name: string;
  name_by_user: string | null;
  area_id: string | null;
  disabled_by: string | null;
  configuration_url: string | null;
  manufacturer: string | null;
  model: string | null;
  sw_version: string | null;
  hw_version: string | null;
}

export interface Area {
  area_id: string;
  name: string;
  picture: string | null;
}

export interface CachedData<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface HistoryEntry {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

export interface Anomaly {
  entity_id: string;
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  detected_at: string;
}
