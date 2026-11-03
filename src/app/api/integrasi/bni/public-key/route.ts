const key =
  "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAp/f+9KTtUzNL2rSKTvp6\nqj5PaTpkKac5syAFRm/bRPjU8g03cMLY859vfy0eZ043YwZyI2upJAZZJdF8Q8nc\nTQCxSIMRn+gb3pErU8AJuhdjS3R7ydB7CiAZpHC6/P7fDxgw5uv/xXhgojfwvmFm\nNzzSrkNGYRJ/0Zt6/ocXf9HRa1UsL0VFgcOwNk6p1NRQh3/OlLxIaeM/iJypQngq\n7FRnyagV4/Djq3joVhniKCggNZKPpAi3VD0qID4O87mhsGdFubuHsdeXn98r2fx/\ntrSSllgA9m2raTzlOK10HGMcjVqz42LrA5iaYA00E2ZbzVfXj3DVy99QPjUZ9hHz\nbwIDAQAB\n-----END PUBLIC KEY-----\n";
export async function GET() {
  return new Response(key, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
