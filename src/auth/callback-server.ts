import { createServer } from 'node:http';

const DEFAULT_PORT = 19877;
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface CallbackResult {
  code: string;
  state: string;
}

/**
 * Cancel any existing callback server on the given port.
 * Matches codex CLI behavior: send GET /cancel before binding.
 */
async function cancelExistingServer(port: number): Promise<void> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    await fetch(`http://127.0.0.1:${port}/cancel`, { signal: controller.signal });
    clearTimeout(timeout);
    // Give the old server time to close
    await new Promise((r) => setTimeout(r, 300));
  } catch {
    // No existing server or it's already gone — fine
  }
}

/**
 * Start a local HTTP server to receive the OAuth callback.
 * Handles /auth/callback path. Ignores favicon and other paths.
 * Sends /cancel to any existing server on the port before binding.
 */
export async function startCallbackServer(
  port: number = DEFAULT_PORT,
  expectedState?: string,
): Promise<CallbackResult> {
  // Try to cancel any existing server on this port (matching codex CLI behavior)
  await cancelExistingServer(port);

  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);

      // Handle /cancel — allow other processes to shut us down
      if (url.pathname === '/cancel') {
        res.writeHead(200);
        res.end('cancelled');
        server.close();
        clearTimeout(timeoutId);
        reject(new Error('OAuth callback server cancelled by another process'));
        return;
      }

      // Only handle /auth/callback — silently ignore other paths (favicon, etc.)
      if (url.pathname !== '/auth/callback' && url.pathname !== '/oauth-callback') {
        res.writeHead(404);
        res.end();
        return;
      }

      clearTimeout(timeoutId);

      // Check for error from authorization server
      const error = url.searchParams.get('error');
      if (error) {
        const description = url.searchParams.get('error_description') ?? error;
        res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>Authorization failed</h1></body></html>');
        server.close();
        reject(new Error(`OAuth authorization error: ${description}`));
        return;
      }

      // Validate state if expected
      const state = url.searchParams.get('state') ?? '';
      if (expectedState && state !== expectedState) {
        res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>State mismatch</h1></body></html>');
        server.close();
        reject(new Error('OAuth callback state mismatch (possible CSRF)'));
        return;
      }

      // Extract authorization code
      const code = url.searchParams.get('code');
      if (!code) {
        res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' });
        res.end('<html><body><h1>Missing authorization code</h1></body></html>');
        server.close();
        reject(new Error('OAuth callback missing code parameter'));
        return;
      }

      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        '<html><body><h1>Authorization successful. You can close this tab.</h1></body></html>',
      );
      server.close();
      resolve({ code, state });
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
