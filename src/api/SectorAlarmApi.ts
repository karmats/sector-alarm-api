interface DeviceInfo {
  pin: string;
  deviceId: string;
}
interface SectorAlarmInfo {
  ArmedStatus: string;
  IsOnline: boolean;
  PanelTime: string;
}
interface SectorAlarmTemperature {
  Label: string;
  Temprature: string;
}
interface SectorAlarmMeta {
  version: string;
  cookie: string;
}

export class SectorAlarmApi {
  private static BASE_URL = "https://mypagesapi.sectoralarm.net";
  private static REQUEST_VERIFICATON_TOKEN_NAME = "__RequestVerificationToken";

  private cookie: string;

  constructor(
    private username: string,
    private password: string,
    private device: DeviceInfo
  ) {}

  private authenticateToSectorAlarm(): Promise<SectorAlarmMeta> {
    return fetch(`${SectorAlarmApi.BASE_URL}/User/Login`, {
      method: "GET",
    }).then((response) => {
      return new Promise<SectorAlarmMeta>(async (resolve, reject) => {
        let content = await response.text();
        if (content) {
          const versionRegex = /<script src="\/Scripts\/main.js\?(v.*)"/g;
          const cookie = response.headers.get("set-cookie");
          const versionResult = versionRegex.exec(content);
          const version = versionResult ? versionResult[1] : null;
          if (version && cookie) {
            return { cookie, version };
          } else {
            throw new Error("Failed to retrieve session meta.");
          }
        } else {
          throw new Error("Response did not have a text");
        }
      }).then((meta) => {
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
    });
  }
}
