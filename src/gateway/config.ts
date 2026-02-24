import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';

const DEFAULT_GATEWAY_PATH = join(homedir(), '.dexter', 'gateway.json');

const TelegramAccountSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional().default(true),
  botToken: z.string().optional().default(''),
  allowedChatIds: z.array(z.number()).optional().default([]),
});

const GatewayConfigSchema = z.object({
  gateway: z
    .object({
      accountId: z.string().optional(),
      logLevel: z.enum(['silent', 'error', 'info', 'debug']).optional(),
      heartbeatSeconds: z.number().optional(),
    })
    .optional(),
  channels: z
    .object({
      telegram: z
        .object({
          enabled: z.boolean().optional(),
          accounts: z.record(z.string(), TelegramAccountSchema).optional(),
        })
        .optional(),
    })
    .optional(),
  bindings: z
    .array(
      z.object({
        agentId: z.string(),
        match: z.object({
          channel: z.string(),
          accountId: z.string().optional(),
          peerId: z.string().optional(),
          peerKind: z.enum(['direct', 'group']).optional(),
        }),
      }),
    )
    .optional()
    .default([]),
});

export type GatewayConfig = {
  gateway: {
    accountId: string;
    logLevel: 'silent' | 'error' | 'info' | 'debug';
    heartbeatSeconds?: number;
  };
  channels: {
    telegram: {
      enabled: boolean;
      accounts: Record<string, z.infer<typeof TelegramAccountSchema>>;
    };
  };
  bindings: Array<{
    agentId: string;
    match: {
      channel: string;
      accountId?: string;
      peerId?: string;
      peerKind?: 'direct' | 'group';
    };
  }>;
};

export type TelegramAccountConfig = {
  accountId: string;
  name?: string;
  enabled: boolean;
  botToken: string;
  allowedChatIds: number[];
};

export function getGatewayConfigPath(overridePath?: string): string {
  return overridePath ?? process.env.DEXTER_GATEWAY_CONFIG ?? DEFAULT_GATEWAY_PATH;
}

export function loadGatewayConfig(overridePath?: string): GatewayConfig {
  const path = getGatewayConfigPath(overridePath);

  // Start with defaults
  let fileConfig: z.infer<typeof GatewayConfigSchema> | undefined;
  if (existsSync(path)) {
    const raw = readFileSync(path, 'utf8');
    fileConfig = GatewayConfigSchema.parse(JSON.parse(raw));
  }

  // Env vars override file config for token and chat IDs
  const envToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const envChatIds = (process.env.TELEGRAM_CHAT_ID ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter(n => !isNaN(n));

  const fileAccounts = fileConfig?.channels?.telegram?.accounts ?? {};

  // If env token is set, ensure the default account uses it
  if (envToken) {
    if (!fileAccounts['default']) {
      fileAccounts['default'] = { enabled: true, botToken: envToken, allowedChatIds: envChatIds };
    } else {
      fileAccounts['default'].botToken = envToken;
      if (envChatIds.length > 0) {
        fileAccounts['default'].allowedChatIds = envChatIds;
      }
    }
  }

  return {
    gateway: {
      accountId: fileConfig?.gateway?.accountId ?? 'default',
      logLevel: fileConfig?.gateway?.logLevel ?? 'info',
      heartbeatSeconds: fileConfig?.gateway?.heartbeatSeconds,
    },
    channels: {
      telegram: {
        enabled: fileConfig?.channels?.telegram?.enabled ?? true,
        accounts: fileAccounts,
      },
    },
    bindings: fileConfig?.bindings ?? [],
  };
}

export function saveGatewayConfig(config: GatewayConfig, overridePath?: string): void {
  const path = getGatewayConfigPath(overridePath);
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(config, null, 2), 'utf8');
}

export function listTelegramAccountIds(cfg: GatewayConfig): string[] {
  const accounts = cfg.channels.telegram.accounts ?? {};
  const ids = Object.keys(accounts);
  return ids.length > 0 ? ids : [cfg.gateway.accountId];
}

export function resolveTelegramAccount(
  cfg: GatewayConfig,
  accountId: string,
): TelegramAccountConfig {
  const account = cfg.channels.telegram.accounts?.[accountId] ?? {};
  return {
    accountId,
    enabled: account.enabled ?? true,
    name: account.name,
    botToken: account.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '',
    allowedChatIds: account.allowedChatIds ?? [],
  };
}
