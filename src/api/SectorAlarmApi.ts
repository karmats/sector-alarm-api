import {
  ArmedStatus,
  DeviceInfo,
  HomeAlarmInfo,
  SectorAlarmInfo,
  SectorAlarmMeta,
  SectorAlarmTemperature,
  Temperature,
} from "./types";

export class SectorAlarmApi {
  private static BASE_URL = "https://mypagesapi.sectoralarm.net";
  private static REQUEST_VERIFICATON_TOKEN_NAME = "__RequestVerificationToken";

  private cookie = "";

  constructor(
    private username: string,
    private password: string,
    private device: DeviceInfo
  ) {}

  private async authenticateToSectorAlarm(): Promise<SectorAlarmMeta> {
    return fetch(`${SectorAlarmApi.BASE_URL}/User/Login`, {
      method: "GET",
    })
      .then(async (response) => {
        let content = await response.text();
        if (content) {
          const versionRegex = /<script src="\/Scripts\/main.js\?(v.*)"/g;
          const cookie = response.headers.get("set-cookie");
          const versionResult = versionRegex.exec(content);
          const version = versionResult ? versionResult[1] : null;
          if (version && cookie) {
            return Promise.resolve({ cookie, version });
          } else {
            return Promise.reject("Failed to retrieve session meta.");
          }
        } else {
          return Promise.reject("Response did not have a text");
        }
      })
      .then((meta) => {
        const verficationToken = meta.cookie
          .split(";")
          .find((c) =>
            c.startsWith(SectorAlarmApi.REQUEST_VERIFICATON_TOKEN_NAME)
          );
        const token = verficationToken && verficationToken.split("=")[1];

        if (token) {
          const formdata = new FormData();
          formdata.append("userID", this.username);
          formdata.append("password", this.password);
          formdata.append(SectorAlarmApi.REQUEST_VERIFICATON_TOKEN_NAME, token);

          return fetch(`${SectorAlarmApi.BASE_URL}/User/Login`, {
            method: "post",
            body: formdata,
          }).then((response) => {
            if (response.status !== 302) {
              throw new Error(
                `Expected 302 response code, instead got ${response.status}.`
              );
            } else {
              const setCookieHeader = response.headers.get("set-cookie");
              if (setCookieHeader && setCookieHeader.length) {
                const sessionMeta = {
                  cookie: setCookieHeader[0],
                  version: meta.version,
                };
                this.cookie = JSON.stringify(sessionMeta);
                return sessionMeta;
              } else {
                throw new Error(
                  `Expected set-cookie header to be defined, ${setCookieHeader}`
                );
              }
            }
          });
        } else {
          throw new Error("Something went work");
        }
      });
  }

  /**
   * Get cookie and version for calls to api
   */
  private async getSessionMeta(): Promise<SectorAlarmMeta> {
    return new Promise((resolve) => {
      if (!this.cookie) {
        resolve(this.authenticateToSectorAlarm());
      } else {
        const sessionMeta: SectorAlarmMeta = JSON.parse(this.cookie);
        // Check that the cookie hasn't expired. If it has, re-authenticate
        fetch(`${SectorAlarmApi.BASE_URL}/User/GetUserInfo`, {
          method: "GET",
          headers: this.headers(sessionMeta.cookie),
        })
          .then((response) => {
            if (response.status === 200) {
              resolve(sessionMeta);
            } else {
              resolve(this.authenticateToSectorAlarm());
            }
          })
          .catch((e) => {
            resolve(this.authenticateToSectorAlarm());
          });
      }
    });
  }

  /**
   * Get house alarm status. If there are more than one alarm registered only the first will be returned.
   */
  public async getAlarmStatus(): Promise<HomeAlarmInfo> {
    return this.getSessionMeta().then((meta) => {
      return fetch(`${SectorAlarmApi.BASE_URL}/Panel/GetPanelList`, {
        headers: this.headers(meta.cookie),
      })
        .then((response) => response.json() as Promise<SectorAlarmInfo[]>)
        .then((json) => {
          if (json && json.length) {
            const info = json
              .map((j) => ({
                status: this.armedStatusToAlarmStatus(j.ArmedStatus),
                online: j.IsOnline,
                time: this.sectorAlarmDateToMs(j.PanelTime),
              }))
              .pop() as HomeAlarmInfo;
            console.log(`Got alarm info status '${info?.status}'`);
            return info;
          } else {
            const error = "Expected at least one alarm, got zero";
            console.log(error);
            throw new Error(error);
          }
        })
        .catch((e) => {
          console.error(`Get alarm status failed: "${e.toString()}"`);
          throw e;
        });
    });
  }

  /**
   * Get temperatures from sensors in the house
   */
  public async getTemperatures(): Promise<Temperature[]> {
    return this.getSessionMeta().then((meta) => {
      return fetch(`${SectorAlarmApi.BASE_URL}/Panel/GetTempratures`, {
        method: "POST",
        body: JSON.stringify({
          id: this.device.deviceId,
          Version: meta.version,
        }),
        headers: this.headers(meta.cookie),
      })
        .then(
          (response) => response.json() as Promise<SectorAlarmTemperature[]>
        )
        .then((json) => {
          if (json && json.length) {
            return json.map(
              (j) =>
                ({
                  location: j.Label,
                  value: +j.Temprature,
                  scale: "C",
                } as Temperature)
            );
          } else {
            const error = `Failed to retrieve temparatures got response '${JSON.stringify(
              json
            )}'`;
            console.error(error);
            throw new Error(error);
          }
        })
        .catch((e) => {
          console.error(`Get temperatures failed: "${e.toString()}"`);
          throw e;
        });
    });
  }

  /** Toggle alarm. If alarm is off, partial alarm is set. If alarm is set to full, nothing is done. Otherwise the alarm turns off */
  toggleAlarm = async (): Promise<HomeAlarmInfo> => {
    return this.getAlarmStatus().then(async (info) => {
      if (info.status === "full") {
        return info;
      }
      const armCmd = info.status === "off" ? "Partial" : "Disarm";
      return this.getSessionMeta().then(async (meta) => {
        return fetch(`${SectorAlarmApi.BASE_URL}/Panel/ArmPanel`, {
          method: "POST",
          body: JSON.stringify({
            ArmCmd: armCmd,
            PanelCode: this.device.pin,
            HasLocks: false,
            id: this.device.deviceId,
          }),
          headers: this.headers(meta.cookie),
        })
          .then(
            (response) =>
              response.json() as Promise<{ panelData: SectorAlarmInfo }>
          )
          .then((json) => ({
            status: this.armedStatusToAlarmStatus(json.panelData.ArmedStatus),
            online: json.panelData.IsOnline,
            time: this.sectorAlarmDateToMs(json.panelData.PanelTime),
          }));
      });
    });
  };

  private headers(cookie: string) {
    return {
      Accept: "application/json",
      "Content-type": "application/json",
      Cookie: cookie,
    };
  }

  private armedStatusToAlarmStatus(armedStatus: string): ArmedStatus {
    switch (armedStatus) {
      case "armed":
        return "full";
      case "partialarmed":
        return "partial";
      case "disarmed":
        return "off";
      default:
        return "unknown";
    }
  }

  private sectorAlarmDateToMs(date: string): number {
    const ms = /\/Date\((-?\d*)\)\//.exec(date);
    return ms && ms[1] ? +ms[1] : -1;
  }
}
