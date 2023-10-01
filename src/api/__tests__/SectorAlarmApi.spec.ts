import { SectorAlarmApi } from '../SectorAlarmApi';

describe('SectorAlarmApi', () => {
  it('should create instance', () => {
    const api = new SectorAlarmApi('username', 'password', { deviceId: 'abc-123', pin: '1234' });

    expect(api).toBeInstanceOf(SectorAlarmApi);
    expect(api.getAlarmStatus).toBeDefined();
    expect(api.getTemperatures).toBeDefined();
  });
});
