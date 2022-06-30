import axios, { AxiosError } from "axios";
import { parseCookies, setCookie } from "nookies";

let cookies = parseCookies();
let isRefreshing = false;
let failedRequests: any[] = [];

interface AxiosErrorResponse {
  code?: string;
}

export const api = axios.create({
  baseURL: "http://localhost:3333",
  headers: {
    Authorization: `Bearer ${cookies["nextauth.token"]}`,
  },
});

// primeiro parametro é o que fazer quando der sucesso
// segundo parametro é o que fazer quando der erro
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError<AxiosErrorResponse>) => {
    if (error.response?.status === 401) {
      if (error.response?.data.code === "token.expired") {
        //renovar token
        cookies = parseCookies();

        const { "nextauth.refreshToken": refreshToken } = cookies;
        const originalConfig = error.config;

        if (!isRefreshing) {
          isRefreshing = true;
          api
            .post("/refresh", {
              refreshToken,
            })
            .then((response) => {
              const { token } = response.data;

              setCookie(undefined, "nextauth.token", token, {
                maxAge: 30 * 24 * 60 * 60, // 30 days
                path: "/",
              });
              setCookie(
                undefined,
                "nextauth.refreshToken",
                response.data.refreshToken,
                {
                  maxAge: 30 * 24 * 60 * 60, // 30 days
                  path: "/",
                }
              );

              api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

              failedRequests.forEach((req) => req.onSuccess(token));
              failedRequests = [];
            })
            .catch((err) => {
              failedRequests.forEach((req) => req.onFailure(err));
              failedRequests = [];
            })
            .finally(() => {
              isRefreshing = false;
            });
        }
        return new Promise((resolve, reject) => {
          failedRequests.push({
            onSuccess: (token: string) => {
              if (originalConfig)
                originalConfig.headers["Authorization"] = `Bearer ${token}`;
              resolve(api(originalConfig));
            },
            onFailure: (err: AxiosError) => {
              reject(err);
            },
          });
        });
      } else {
        //redirecionar para login
      }
    }
  }
);
