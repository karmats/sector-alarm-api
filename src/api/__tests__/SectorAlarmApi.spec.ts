import { SectorAlarmApi } from '../SectorAlarmApi';

describe('SectorAlarmApi', () => {
  const fetchMock = vi.fn();
  globalThis.fetch = fetchMock;

  const setup = () => {
    // Initial response
    fetchMock.mockResolvedValueOnce({
      headers: { get: () => '__RequestVerificationToken=abc123' },
      text: () => Promise.resolve('<script src="/Scripts/main.js?v1_2_M13"></script>'),
    });
    // Login response
    fetchMock.mockResolvedValueOnce({
      headers: { get: () => '__RequestVerificationToken=abc123' },
      status: 302,
    });

    return new SectorAlarmApi('username', 'password', { deviceId: 'abc-123', pin: '1234' });
  };

  it('should create instance', () => {
    const api = new SectorAlarmApi('username', 'password', { deviceId: 'abc-123', pin: '1234' });

    expect(api).toBeInstanceOf(SectorAlarmApi);
    expect(api.getAlarmStatus).toBeDefined();
    expect(api.getTemperatures).toBeDefined();
  });

  it('should throw error if login fails', async () => {
    fetchMock.mockRejectedValue(new Error('Login failed'));
    const api = new SectorAlarmApi('username', 'password', { deviceId: 'abc-123', pin: '1234' });

    await expect(api.getAlarmStatus()).rejects.toThrowError();
    await expect(api.getTemperatures()).rejects.toThrowError();
  });

  it('should get alarm status', async () => {
    const api = setup();
    // Alarm status response
    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve([{ ArmedStatus: 'armed', IsOnline: true, PanelTime: '/Date(20321231)/' }]),
    });

    await expect(api.getAlarmStatus()).resolves.toEqual({ status: 'full', online: true, time: 20321231 });
  });

  it('should get temperatures', async () => {
    const api = setup();
    // Temperature response
    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve([{ Label: 'Bedroom', Temprature: '20.3' }]),
    });

    await expect(api.getTemperatures()).resolves.toEqual([{ location: 'Bedroom', value: 20.3, scale: 'C' }]);
  });

  it('should throw error if temperature response is invalid', async () => {
    const api = setup();
    // Temperature response
    fetchMock.mockRejectedValueOnce(new Error('Invalid response'));

    await expect(api.getTemperatures()).rejects.toThrowError();
  });

  it('should not toggle alarm if alarm is armed', async () => {
    const api = setup();
    // Alarm status response
    fetchMock.mockResolvedValueOnce({
      json: () => Promise.resolve([{ ArmedStatus: 'armed', IsOnline: true, PanelTime: '/Date(20321231)/' }]),
    });

    await expect(api.toggleAlarm()).resolves.toEqual({ status: 'full', online: true, time: 20321231 });
  });
});
