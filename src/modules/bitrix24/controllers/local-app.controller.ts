import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IntegrationStorage } from '../../../storage/integration-storage.js';

interface InstallPayload {
  event?: string;
  auth?: {
    domain?: string;
    scope?: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: string | number;
    client_endpoint?: string;
    server_endpoint?: string;
    member_id?: string;
    application_token?: string;
  };
}

export class LocalAppController {
  constructor(private readonly storage: IntegrationStorage) {}

  installInfo = async () => ({
    status: 'ready',
    endpoint: '/b24/install',
    mode: 'ONAPPINSTALL callback',
  });

  install = async (
    request: FastifyRequest<{ Body: InstallPayload }>,
    reply: FastifyReply,
  ) => {
    const payload = request.body;

    if (payload?.event !== 'ONAPPINSTALL' || !payload.auth) {
      request.log.warn({ event: 'B24_INSTALL_INVALID' });
      return reply.code(400).send({ status: 'invalid' });
    }

    const auth = payload.auth;
    const required = [
      auth.domain,
      auth.access_token,
      auth.refresh_token,
      auth.client_endpoint,
      auth.server_endpoint,
      auth.member_id,
      auth.application_token,
    ];

    if (required.some((value) => !value)) {
      request.log.warn({ event: 'B24_INSTALL_MISSING_AUTH' });
      return reply.code(400).send({ status: 'invalid' });
    }

    const expiresIn = Number(auth.expires_in ?? 3600);

    await this.storage.saveTokens({
      accessToken: auth.access_token!,
      refreshToken: auth.refresh_token!,
      expiresAt: Date.now() + Math.max(expiresIn, 0) * 1000,
      oauthServer: 'oauth.bitrix.info',
    });

    await this.storage.saveBitrix24Installation({
      domain: auth.domain!,
      memberId: auth.member_id!,
      clientEndpoint: auth.client_endpoint!,
      serverEndpoint: auth.server_endpoint!,
      scope: auth.scope ?? '',
      applicationToken: auth.application_token!,
    });

    request.log.info({
      event: 'B24_APP_INSTALLED',
      domain: auth.domain,
      memberId: auth.member_id,
      scope: auth.scope,
    });

    return reply.type('text/plain').send('OK');
  };

  handler = async (_request: FastifyRequest, reply: FastifyReply) => {
    const installation = await this.storage.getBitrix24Installation();

    const status = installation
      ? `Connected to ${installation.domain}`
      : 'Bitrix24 installation data has not been received yet';

    return reply.type('text/html; charset=utf-8').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Hermes AI</title>
</head>
<body>
  <main>
    <h1>Hermes AI</h1>
    <p>${status}</p>
  </main>
</body>
</html>`);
  };
}
