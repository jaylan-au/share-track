import { useRef } from 'preact/hooks';
import { FlashMessageType, LibraryStatus, PortfolioSummary, TrashedPortfolioSummary } from './types';
import { getSignInUrl } from './api/files-api';

interface PortfolioLibraryPageProps {
    status: LibraryStatus;
    error: string | null;
    flashMessage: string | null;
    flashMessageType: FlashMessageType;
    portfolios: PortfolioSummary[];
    trashedPortfolios: TrashedPortfolioSummary[];
    activePortfolioId: string | null;
    onRefresh: () => void;
    onOpen: (fileId: string) => void;
    onNewPortfolio: () => void;
    onImportFile: (file: File | null) => void;
    onTrash: (fileId: string) => void;
    onRestore: (fileId: string) => void;
    onDeletePermanently: (fileId: string) => void;
    onBack: () => void;
}

function formatDateTime(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function PortfolioLibraryPage(props: PortfolioLibraryPageProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { status, error, portfolios, trashedPortfolios, activePortfolioId } = props;

    return (
        <div class="app-shell">
            <header class="library-header">
                <div>
                    <p class="library-eyebrow">ShareTrack</p>
                    <h1>Your portfolios</h1>
                </div>
                <div class="library-actions">
                    <button class="secondary-button" type="button" onClick={props.onBack}>Back to portfolio</button>
                    <button class="primary-button" type="button" onClick={props.onNewPortfolio}>New portfolio</button>
                    <button class="secondary-button" type="button" onClick={() => fileInputRef.current?.click()}>Import JSON</button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,application/json"
                        class="visually-hidden"
                        onInput={(event) => {
                            const input = event.target as HTMLInputElement;
                            props.onImportFile(input.files?.[0] ?? null);
                            input.value = '';
                        }}
                    />
                </div>
            </header>

            <main class="content-panel library-panel">
                {props.flashMessage ? (
                    <div class={`flash-message flash-message-${props.flashMessageType}`} role="status">
                        {props.flashMessage}
                    </div>
                ) : null}
                {error ? <div class="error-message">{error}</div> : null}

                {status === 'loading' ? <div class="loading-state">Loading your portfolios...</div> : null}

                {status === 'signin-required' ? (
                    <section class="library-notice" role="alert">
                        <h2>Sign in to see your portfolios</h2>
                        <p>Your portfolios are protected by Cloudflare Access. Sign in in a new tab, then come back and refresh.</p>
                        <div class="library-actions">
                            <a class="primary-button" href={getSignInUrl()} target="_blank" rel="noopener noreferrer">Sign in</a>
                            <button class="secondary-button" type="button" onClick={props.onRefresh}>I've signed in, refresh</button>
                        </div>
                    </section>
                ) : null}

                {status === 'ready' ? (
                    <>
                        <section class="library-section" aria-labelledby="library-portfolios-heading">
                            <div class="library-section-header">
                                <h2 id="library-portfolios-heading">Saved portfolios</h2>
                                <button class="icon-button" type="button" onClick={props.onRefresh} aria-label="Refresh portfolios">↻</button>
                            </div>

                            {portfolios.length === 0 ? (
                                <p class="library-empty">No saved portfolios yet. Create one, or import a JSON file.</p>
                            ) : (
                                <ul class="library-list">
                                    {portfolios.map((portfolio) => (
                                        <li key={portfolio.id} class="library-card">
                                            <div class="library-card-body">
                                                <strong>{portfolio.fileName}</strong>
                                                <span class="library-meta">
                                                    Updated {formatDateTime(portfolio.updatedAt)} · {portfolio.versionCount} {portfolio.versionCount === 1 ? 'version' : 'versions'}
                                                </span>
                                            </div>
                                            <div class="library-card-actions">
                                                {activePortfolioId === portfolio.id ? <span class="library-badge">Open</span> : null}
                                                <button class="secondary-button" type="button" onClick={() => props.onOpen(portfolio.id)}>Open</button>
                                                <button class="danger-button" type="button" onClick={() => props.onTrash(portfolio.id)}>Move to trash</button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section class="library-section" aria-labelledby="library-trash-heading">
                            <div class="library-section-header">
                                <h2 id="library-trash-heading">Trash</h2>
                            </div>

                            {trashedPortfolios.length === 0 ? (
                                <p class="library-empty">The trash is empty.</p>
                            ) : (
                                <ul class="library-list">
                                    {trashedPortfolios.map((portfolio) => (
                                        <li key={portfolio.id} class="library-card library-card-trashed">
                                            <div class="library-card-body">
                                                <strong>{portfolio.fileName}</strong>
                                                <span class="library-meta">Moved to trash {formatDateTime(portfolio.trashedAt)}</span>
                                            </div>
                                            <div class="library-card-actions">
                                                <button class="secondary-button" type="button" onClick={() => props.onRestore(portfolio.id)}>Restore</button>
                                                <button class="danger-button" type="button" onClick={() => props.onDeletePermanently(portfolio.id)}>Delete forever</button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </>
                ) : null}
            </main>
        </div>
    );
}
