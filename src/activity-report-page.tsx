import { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { HoldingEntity, ShareLot, ShareLotTransaction, ShareTransaction, ShareSecurity } from './model/data-model';
import { ActivityReportFilters, createActivityMarkdownReport } from './model/activity-report';

interface ActivityReportPageProps {
    transactions: ShareTransaction[];
    lots: ShareLot[];
    lotLinks: ShareLotTransaction[];
    holdingEntities: HoldingEntity[];
    securities: ShareSecurity[];
    hasUnsavedChanges: boolean;
    onBack: () => void;
}

function getCurrentDateString(): string {
    return new Date().toISOString().slice(0, 10);
}

export function ActivityReportPage({ transactions, lots, lotLinks, holdingEntities, securities, hasUnsavedChanges, onBack }: ActivityReportPageProps): ComponentChildren {
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState(getCurrentDateString());
    const [holdingEntity, setHoldingEntity] = useState('');
    const [code, setCode] = useState('');
    const [report, setReport] = useState('');
    const [error, setError] = useState<string | null>(null);

    const createReport = (): void => {
        if (!fromDate || !toDate) {
            setError('Please provide both a start date and an end date.');
            return;
        }

        if (fromDate > toDate) {
            setError('The start date must be on or before the end date.');
            return;
        }

        const holdingEntityNames = new Map(holdingEntities.map((entity) => [String(entity.id), entity.name]));
        setReport(createActivityMarkdownReport({ fromDate, toDate, holdingEntity, code } satisfies ActivityReportFilters, holdingEntityNames, transactions, lots, lotLinks));
        setError(null);
    };

    const downloadReport = (): void => {
        if (!report) {
            return;
        }

        const blob = new Blob([report], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `share-activity-report-${fromDate}-to-${toDate}.md`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div class="app-shell">
            <header class="app-header">
                <div>
                    <p class="eyebrow">ShareTrack</p>
                    <h1>Activity report</h1>
                    {hasUnsavedChanges ? <span class="unsaved-changes">Unsaved changes</span> : null}
                </div>
                <div class="header-actions">
                    {report ? <button class="secondary-button" type="button" onClick={downloadReport}>Download markdown</button> : null}
                    <button class="secondary-button" type="button" onClick={onBack}>Back to portfolio</button>
                </div>
            </header>

            <main class="content-panel">
                {error ? <div class="error-message">{error}</div> : null}
                <section class="share-lots-filters">
                    <div class="share-lots-filters-header">
                        <h2>Create markdown report</h2>
                    </div>
                    <div class="form-grid">
                        <label class="field">
                            <span>From date *</span>
                            <input type="date" value={fromDate} onInput={(event) => setFromDate((event.target as HTMLInputElement).value)} required />
                        </label>
                        <label class="field">
                            <span>To date *</span>
                            <input type="date" value={toDate} onInput={(event) => setToDate((event.target as HTMLInputElement).value)} required />
                        </label>
                        <label class="field">
                            <span>Holding entity</span>
                            <select value={holdingEntity} onInput={(event) => setHoldingEntity((event.target as HTMLSelectElement).value)}>
                                <option value="">All holding entities</option>
                                {holdingEntities.map((entity) => <option value={String(entity.id)} key={String(entity.id)}>{entity.name}</option>)}
                            </select>
                        </label>
                        <label class="field">
                            <span>Share code</span>
                            <select value={code} onInput={(event) => setCode((event.target as HTMLSelectElement).value)}>
                                <option value="">All share codes</option>
                                {securities.map((security) => <option value={security.code} key={String(security.id)}>{security.code}</option>)}
                            </select>
                        </label>
                    </div>
                    <div class="form-actions">
                        <button class="primary-button" type="button" onClick={createReport}>Create report</button>
                    </div>
                </section>

                {report ? <pre class="activity-report-preview">{report}</pre> : <div class="empty-state">Choose a date range and create a report.</div>}
            </main>
        </div>
    );
}