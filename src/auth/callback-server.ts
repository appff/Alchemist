import { createServer } from 'node:http';

const DEFAULT_PORT = 19877;
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface CallbackResult {
  code: string;
  state: string;
}

export function startCallbackServer(port: number = DEFAULT_PORT): Promise<CallbackResult> {
  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const server = createServer((req, res) => {
      clearTimeout(timeoutId);
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);

      const error = url.searchParams.get('error');
      if (error) {
        const description = url.searchParams.get('error_description') ?? error;
        res.writeHead(400, { 'content-type': 'text/html' });
        res.end('<html><body><h1>Authorization failed</h1></body></html>');
        server.close();
        reject(new Error(`OAuth authorization error: ${description}`));
        return;
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (!code) {
        res.writeHead(400, { 'content-type': 'text/html' });
        res.end('<html><body><h1>Missing authorization code</h1></body></html>');
        server.close();
        reject(new Error('OAuth callback missing code parameter'));
        return;
      }

      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<html><body><h1>Authorization successful. You can close this tab.</h1></body></html>');
      server.close();
      resolve({ code, state: state ?? '' });
    });

    timeoutId = setTimeout(() => {
      server.close();
      reject(new Error('OAuth callback timed out after 5 minutes'));
    }, TIMEOUT_MS);

    server.listen(port, '127.0.0.1');
    server.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}
