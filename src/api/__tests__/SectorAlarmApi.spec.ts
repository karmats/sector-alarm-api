import { SectorAlarmApi } from '../SectorAlarmApi';
import { describe, it, mock, beforeEach } from 'node:test';
import * as assert from 'node:assert';

describe('SectorAlarmApi', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  const setupFetchCalls = (response: Promise<unknown>) => {
    const fetchMock = mock.method(globalThis, 'fetch');
    fetchMock.mock.mockImplementation((url: string, { method }: { method: 'post' | 'get' }) => {
      if (url.includes('/User/Login')) {
        const requestMethod = method.toLowerCase();
        // Initial response
        return requestMethod === 'get'
          ? Promise.resolve({
              headers: { get: () => '__RequestVerificationToken=abc123' },
              text: () => '<script src="/Scripts/main.js?v1_2_M13"></script>',
            })
          : // Login response
            Promise.resolve({
              headers: { get: () => '__RequestVerificationToken=abc123' },
              status: 302,
            });
      }
      return response;
    });
    return { fetchMock, api: new SectorAlarmApi('username', 'password', { deviceId: 'abc-123', pin: '1234' }) };
  };

  it('should create instance', () => {
    const api = new SectorAlarmApi('username', 'password', { deviceId: 'abc-123', pin: '1234' });

    assert.ok(api instanceof SectorAlarmApi);
    assert.ok(api.getAlarmStatus);
    assert.ok(api.getTemperatures);
  });

  it('should throw error if login fails', async () => {
    mock.method(globalThis, 'fetch').mock.mockImplementation(() => Promise.reject('Login failed'));
    const api = new SectorAlarmApi('username', 'password', { deviceId: 'abc-123', pin: '1234' });

    await assert.rejects(api.getAlarmStatus);
    await assert.rejects(api.getTemperatures);
  });

  it('should get alarm status', async () => {
    const { api } = setupFetchCalls(
      Promise.resolve({
        json: async () => [{ ArmedStatus: 'armed', IsOnline: true, PanelTime: '/Date(20321231)/' }],
      })
    );

    const status = await api.getAlarmStatus();
    assert.deepEqual(status, { status: 'full', online: true, time: 20321231 });
  });

  it('should get temperatures', async () => {
    const { api } = setupFetchCalls(
      Promise.resolve({
        json: async () => [{ Label: 'Bedroom', Temprature: '20.3' }],
      })
    );

    const temperatures = await api.getTemperatures();
    assert.deepEqual(temperatures, [{ location: 'Bedroom', value: 20.3, scale: 'C' }]);
  });

  it('should throw error if temperature response is invalid', async () => {
    const { api } = setupFetchCalls(Promise.reject('Invalid response'));

    try {
      await api.getTemperatures();
      assert.fail('Expected test call to fail');
    } catch (e) {
      assert.ok(e);
    }
  });

  it('should not toggle alarm if alarm is armed', async () => {
    const { api } = setupFetchCalls(
      Promise.resolve({
        json: async () => [{ ArmedStatus: 'armed', IsOnline: true, PanelTime: '/Date(20321231)/' }],
      })
    );

    const status = await api.toggleAlarm();
    assert.deepEqual(status, { status: 'full', online: true, time: 20321231 });
  });
});
