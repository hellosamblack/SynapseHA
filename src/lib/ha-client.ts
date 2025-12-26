import axios, { AxiosInstance } from 'axios';
import type { Entity, Service, Device, Area, HistoryEntry } from '../types';

export class HomeAssistantClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(url: string, token: string) {
    this.baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  async getStates(): Promise<Entity[]> {
    const response = await this.client.get<Entity[]>('/api/states');
    return response.data;
  }

  async getState(entityId: string): Promise<Entity> {
    const response = await this.client.get<Entity>(`/api/states/${entityId}`);
    return response.data;
  }

  async callService(
    domain: string,
    service: string,
    serviceData?: any,
    target?: { entity_id?: string | string[] }
  ): Promise<any> {
    const payload: any = {};
    if (target) payload.target = target;
    if (serviceData) payload.service_data = serviceData;
    
    const response = await this.client.post(
      `/api/services/${domain}/${service}`,
      payload
    );
    return response.data;
  }

  async getServices(): Promise<Service[]> {
    const response = await this.client.get<Service[]>('/api/services');
    return response.data;
  }

  async getConfig(): Promise<any> {
    const response = await this.client.get('/api/config');
    return response.data;
  }

  async getHistory(
    entityIds: string[],
    startTime: string,
    endTime?: string
  ): Promise<HistoryEntry[][]> {
    const params: any = {
      filter_entity_id: entityIds.join(','),
    };
    if (endTime) params.end_time = endTime;

    const response = await this.client.get<HistoryEntry[][]>(
      `/api/history/period/${startTime}`,
      { params }
    );
    return response.data;
  }

  async getDevices(): Promise<Device[]> {
    const response = await this.client.get<Device[]>('/api/config/device_registry/list');
    return response.data;
  }

  async getAreas(): Promise<Area[]> {
    const response = await this.client.get<Area[]>('/api/config/area_registry/list');
    return response.data;
  }

  async getEntityRegistry(): Promise<any[]> {
    const response = await this.client.get('/api/config/entity_registry/list');
    return response.data;
  }

  async checkHealth(): Promise<{ message: string }> {
    const response = await this.client.get('/api/');
    return response.data;
  }
}
