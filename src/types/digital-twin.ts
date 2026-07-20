export type ModbusFeedStatus = 'mock' | 'connecting' | 'connected' | 'fallback' | 'error' | 'retrying';

export type ModbusFeedSource = 'mock' | 'ws' | 'fallback';
export type BusinessAlarmFeedSource = 'mock' | 'ws' | 'fallback';
export type BusinessAlarmFeedStatus = 'idle' | 'mock' | 'connecting' | 'connected' | 'fallback' | 'error';

export interface DigitalTwinTemperaturePoint {
  locationId: string;
  locationName: string;
  temperature: number;
  rawTemperature: string;
  receivedAt: string;
  source: ModbusFeedSource;
}

export interface ModbusTemperatureFeed {
  status: ModbusFeedStatus;
  point: DigitalTwinTemperaturePoint | null;
  message: string;
}

export interface DigitalTwinBusinessAlarm {
  id: number | null;
  eventId: string;
  alarmId: string;
  eventTimeStamp: string;
  devId: string;
  channelName: string;
  num: number;
  ruleType: string;
  level: '1' | '2';
  avgTemp: number;
  minTemp: number;
  maxTemp: number;
  thresholdTemp: number;
  locationName: string;
  isRead: 0 | 1;
  processor: string | null;
  processContent: string | null;
  processTime: string | null;
  receivedAt: string;
  source: BusinessAlarmFeedSource;
}

export interface BusinessAlarmFeed {
  status: BusinessAlarmFeedStatus;
  alarm: DigitalTwinBusinessAlarm | null;
  message: string;
}
