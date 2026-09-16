import { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { ShareSecurityPriceRecord } from './model/data-model';
import { formatCurrency } from './model/formatters';

interface PriceRecordDeleteFormProps {
    scopeLabel: string;
    onDelete: (fromDate: string, toDate: string, includePreserved: boolean) => number;
}

interface PriceRecordsPageProps extends PriceRecordDeleteFormProps {
    code: string;
    records: ShareSecurityPriceRecord[];
    hasUnsavedChanges: boolean;
    onBack: () => void;
}

const dateFormatter = new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

function formatTimestamp(timestamp: number): string {
    return Number.isFinite(timestamp) ? dateFormatter.format(new Date(timestamp)) : '—';
}

export function PriceRecordDeleteForm({ scopeLabel, onDelete }: PriceRecordDeleteFormProps): ComponentChildren {
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [includePreserved, setIncludePreserved] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const submit = (): void => {
        if (!fromDate || !toDate) {
            setMessage('Please provide both a from date and a to date.');
            return;
        }

        if (fromDate > toDate) {
            setMessage('The from date must be on or before the to date.');
            return;
        }

        const preservedText = includePreserved ? 'including preserved records' : 'excluding preserved records';
        const confirmed = window.confirm(`Delete ${scopeLabel} price records from ${fromDate} to ${toDate}, ${preservedText}? This cannot be undone.`);
        if (!confirmed) {
            return;
        }

        const deletedCount = onDelete(fromDate, toDate, includePreserved);
        setMessage(deletedCount ? `Deleted ${deletedCount} price record${deletedCount === 1 ? '' : 's'}.` : 'No matching price records were found.');
    };

    return (
        <div class="price-record-delete-form">
            <h3>Delete price records</h3>
            <div class="form-grid">
                <label class="field">
                    <span>From date</span>
                    <input type="date" value={fromDate} onInput={(event) => setFromDate((event.target as HTMLInputElement).value)} />
                </label>
                <label class="field">
                    <span>To date</span>
                    <input type="date" value={toDate} onInput={(event) => setToDate((event.target as HTMLInputElement).value)} />
                </label>
            </div>
            <label class="checkbox-field">
                <input type="checkbox" checked={includePreserved} onInput={(event) => setIncludePreserved((event.target as HTMLInputElement).checked)} />
                <span>Also delete records marked preserve</span>
            </label>
            {message ? <p class="data-upload-note">{message}</p> : null}
            <div class="form-actions">
                <button class="danger-button" type="button" onClick={submit}>Delete matching records</button>
            </div>
        </div>
    );
}

export function PriceRecordsPage({ code, records, hasUnsavedChanges, scopeLabel, onDelete, onBack }: PriceRecordsPageProps): ComponentChildren {
    return (
        <div class="app-shell">
            <header class="app-header">
                <div>
                    <p class="eyebrow">ShareTrack</p>
                    <h1>Price records: {code}</h1>
                    {hasUnsavedChanges ? <span class="unsaved-changes">Unsaved changes</span> : null}
                </div>
                <div class="header-actions">
                    <button class="secondary-button" type="button" onClick={onBack}>Back to Admin</button>
                </div>
            </header>

            <main class="content-panel">
                <PriceRecordDeleteForm scopeLabel={scopeLabel} onDelete={onDelete} />
                <div class="share-lots-table-wrapper">
                    <table class="share-lots-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Price</th>
                                <th>Preserve</th>
                                <th>ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((record) => (
                                <tr key={String(record.id)}>
                                    <td>{formatTimestamp(record.timeStamp)}</td>
                                    <td>{formatCurrency(Number(record.price))}</td>
                                    <td>{record.preserve ? 'Yes' : 'No'}</td>
                                    <td>{record.id}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!records.length ? <div class="empty-state">No price records found for this security.</div> : null}
                </div>
            </main>
        </div>
    );
}