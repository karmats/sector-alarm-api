export interface DeviceInfo {
  pin: string;
  deviceId: string;
}
export interface SectorAlarmInfo {
  ArmedStatus: string;
  IsOnline: boolean;
  PanelTime: string;
}
export interface SectorAlarmTemperature {
  Label: string;
  Temprature: string;
}
export interface SectorAlarmMeta {
  version: string;
  cookie: string;
}
export type ArmedStatus = 'full' | 'partial' | 'off' | 'unknown';
export interface HomeAlarmInfo {
  status: ArmedStatus;
  online: boolean;
  time: Date | number;
}
export interface Temperature {
  location: string;
  value: number;
  scale: 'C' | 'F';
}
