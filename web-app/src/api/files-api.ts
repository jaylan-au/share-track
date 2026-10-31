/// <reference types="vite/client" />
import type { PortfolioSummary, TrashedPortfolioSummary } from '../types';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

/**
 * `auth` means the request was redirected or rejected by Cloudflare Access, so the
 * user needs to sign in. Access redirects cross-origin fetches to its login page,
 * which the browser reports as a network error, so those are also treated as `auth`.
 */
export class PortfolioApiError extends Error {
    constructor(message: string, readonly kind: 'auth' | 'request') {
        super(message);
    }
}

export function getSignInUrl(): string {
    return `${apiBaseUrl}/api/files`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
        response = await fetch(`${apiBaseUrl}${path}`, {
            ...init,
            credentials: 'include',
            headers: init.body ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
        });
    } catch {
        throw new PortfolioApiError('Could not reach the portfolio server. Sign in, then try again.', 'auth');
    }

    if (response.status === 401 || response.status === 403) {
        throw new PortfolioApiError('Sign in is required to access your portfolios.', 'auth');
    }

    if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new PortfolioApiError(body?.error ?? `Request failed (${response.status}).`, 'request');
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return response.json() as Promise<T>;
}

export async function listPortfolios(): Promise<PortfolioSummary[]> {
    const body = await request<{ files: PortfolioSummary[] }>('/api/files');
    return body.files;
}

export async function listTrashedPortfolios(): Promise<TrashedPortfolioSummary[]> {
    const body = await request<{ files: TrashedPortfolioSummary[] }>('/api/trash');
    return body.files;
}

export async function getPortfolioData(fileId: string): Promise<unknown> {
    return request<unknown>(`/api/files/${encodeURIComponent(fileId)}`);
}

export async function savePortfolio(input: { fileId?: string; fileName: string; data: unknown }): Promise<{ id: string; fileName: string; versionId: string }> {
    return request('/api/files', { method: 'POST', body: JSON.stringify(input) });
}

export async function trashPortfolio(fileId: string): Promise<void> {
    await request(`/api/files/${encodeURIComponent(fileId)}/trash`, { method: 'POST' });
}

export async function restorePortfolio(fileId: string): Promise<void> {
    await request(`/api/files/${encodeURIComponent(fileId)}/restore`, { method: 'POST' });
}

export async function deletePortfolioPermanently(fileId: string): Promise<void> {
    await request(`/api/files/${encodeURIComponent(fileId)}`, { method: 'DELETE' });
}
