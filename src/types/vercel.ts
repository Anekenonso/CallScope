import type { IncomingMessage, ServerResponse } from 'http';

export interface VercelRequest extends IncomingMessage {
  query: Partial<Record<string, string | string[]>>;
  cookies: Partial<Record<string, string>>;
  body: any;
}

export interface VercelResponse extends ServerResponse {
  send: (body: any) => VercelResponse;
  json: (jsonBody: any) => VercelResponse;
  status: (statusCode: number) => VercelResponse;
}

