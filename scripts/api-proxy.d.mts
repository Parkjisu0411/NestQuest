import type { IncomingMessage, ServerResponse } from 'node:http'
export function apiProxy(request: IncomingMessage, response: ServerResponse, next?: () => void): Promise<void>
