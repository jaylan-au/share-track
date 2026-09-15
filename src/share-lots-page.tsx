import { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { ShareLot, ShareLotTransaction, ShareTransaction } from './model/data-model';

interface ShareLotsPageProps {
    shareLots: ShareLot[];
    shareTransactions: ShareTransaction[];
    shareLotTransactions: ShareLotTransaction[];
    hasUnsavedChanges: boolean;
    onDeleteShareLot: (shareLotId: string) => void;
    onDeleteSellTransaction: (sellTransactionId: string) => void;
    onBack: () => void;
}

type SortColumn = 'buyDate' | 'code' | 'holdingEntity' | 'unitCount' | 'unitOriginalCost' | 'unitCurrentCost' | 'isOpen';
type SortDirection = 'asc' | 'desc';
type LotStatusFilter = 'all' | 'open' | 'closed';

interface ShareLotRowModel {
    lot: ShareLot;
    buyTransaction?: ShareTransaction;
    linkedTransactions: Array<{
        shareLotTransaction: ShareLotTransaction;
        transaction?: ShareTransaction;
    }>;
    buyDate: number;
}

const currencyFormatter = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'short',
});

function exportShareLotsCsv(rows: ShareLotRowModel[]): void {
    const headers = [
        'Buy date',
        'Code',
        'Holding entity',
        'Units',
        'Unit original cost',
        'Unit current cost',
        'Status',
        'Buy transaction id',
        'Buy transaction document ref',
        'Linked transactions count',
    ];

    const rowsCsv = rows.map((row) => {
        const buyTransaction = row.buyTransaction;
        return [
            formatDate(buyTransaction?.transactionTimestamp),
            row.lot.code,
            row.lot.holdingEntity,
            String(row.lot.unitCount ?? 0),
            String(row.lot.unitOriginalCost ?? 0),
            String(row.lot.unitCurrentCost ?? 0),
            row.lot.isOpen === false ? 'Closed' : 'Open',
            buyTransaction?.id ?? '',
            buyTransaction?.documentRef ?? '',
            String(row.linkedTransactions.length),
        ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
    });

    const csv = [headers.join(','), ...rowsCsv].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = 'share-lots.csv';
    anchor.click();

    URL.revokeObjectURL(url);
}

function formatDate(timestamp?: number): string {
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
        return '—';
    }

    return dateFormatter.format(new Date(timestamp));
}

function formatFilterDate(timestamp: number): string {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return '';
    }

    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

function getSortValue(row: ShareLotRowModel, column: SortColumn): string | number {
    switch (column) {
        case 'buyDate':
            return row.buyDate;
        case 'code':
            return row.lot.code;
        case 'holdingEntity':
            return row.lot.holdingEntity;
        case 'unitCount':
            return Number(row.lot.unitCount ?? 0);
        case 'unitOriginalCost':
            return Number(row.lot.unitOriginalCost ?? 0);
        case 'unitCurrentCost':
            return Number(row.lot.unitCurrentCost ?? 0);
        case 'isOpen':
            return row.lot.isOpen === false ? 0 : 1;
        default:
            return row.lot.id;
    }
}

export function ShareLotsPage({ shareLots, shareTransactions, shareLotTransactions, hasUnsavedChanges, onDeleteShareLot, onDeleteSellTransaction, onBack }: ShareLotsPageProps): ComponentChildren {
    const [sortColumn, setSortColumn] = useState<SortColumn>('buyDate');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [expandedLotIds, setExpandedLotIds] = useState<string[]>([]);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [holdingEntityFilter, setHoldingEntityFilter] = useState('');
    const [codeFilter, setCodeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<LotStatusFilter>('all');

    const rows = useMemo<ShareLotRowModel[]>(() => {
        const transactionMap = new Map(shareTransactions.map((transaction) => [transaction.id, transaction]));

        return shareLots.map((lot) => {
            const linkedTransactions = shareLotTransactions
                .filter((link) => link.shareLot === lot.id)
                .map((link) => ({
                    shareLotTransaction: link,
                    transaction: transactionMap.get(link.shareTransaction),
                }))
                .filter((entry) => entry.transaction);

            const buyTransaction = transactionMap.get(lot.buyTransactionId);

            return {
                lot,
                buyTransaction,
                linkedTransactions,
                buyDate: buyTransaction?.transactionTimestamp ?? 0,
            };
        });
    }, [shareLots, shareLotTransactions, shareTransactions]);

    const sortedRows = useMemo(() => {
        const filteredRows = rows.filter((row) => {
            const buyDate = formatFilterDate(row.buyDate);
            const matchesFromDate = !fromDate || (buyDate && buyDate >= fromDate);
            const matchesToDate = !toDate || (buyDate && buyDate <= toDate);
            const matchesEntity = !holdingEntityFilter || row.lot.holdingEntity === holdingEntityFilter;
            const matchesCode = !codeFilter || row.lot.code === codeFilter;
            const isOpen = row.lot.isOpen !== false;
            const matchesStatus = statusFilter === 'all'
                || (statusFilter === 'open' && isOpen)
                || (statusFilter === 'closed' && !isOpen);

            return Boolean(matchesFromDate && matchesToDate && matchesEntity && matchesCode && matchesStatus);
        });

        return [...filteredRows].sort((left, right) => {
            const leftValue = getSortValue(left, sortColumn);
            const rightValue = getSortValue(right, sortColumn);

            const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
                ? leftValue - rightValue
                : String(leftValue).localeCompare(String(rightValue));

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }, [rows, fromDate, toDate, holdingEntityFilter, codeFilter, statusFilter, sortColumn, sortDirection]);

    const holdingEntities = useMemo(() => {
        return Array.from(new Set(rows.map((row) => row.lot.holdingEntity))).sort((left, right) => left.localeCompare(right));
    }, [rows]);

    const codes = useMemo(() => {
        return Array.from(new Set(rows.map((row) => row.lot.code))).sort((left, right) => left.localeCompare(right));
    }, [rows]);

    const hasActiveFilters = Boolean(fromDate || toDate || holdingEntityFilter || codeFilter || statusFilter !== 'all');

    const clearFilters = (): void => {
        setFromDate('');
        setToDate('');
        setHoldingEntityFilter('');
        setCodeFilter('');
        setStatusFilter('all');
    };

    const toggleExpandedLot = (lotId: string): void => {
        setExpandedLotIds((current) => {
            if (current.includes(lotId)) {
                return current.filter((id) => id !== lotId);
            }

            return [...current, lotId];
        });
    };

    const updateSort = (column: SortColumn): void => {
        if (sortColumn === column) {
            setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
            return;
        }

        setSortColumn(column);
        setSortDirection(column === 'buyDate' ? 'desc' : 'asc');
    };

    return (
        <div class="app-shell">
            <header class="app-header">
                <div>
                    <p class="eyebrow">ShareTrack</p>
                    <h1>Share lots</h1>
                    {hasUnsavedChanges ? <span class="unsaved-changes">Unsaved changes</span> : null}
                </div>
                <div class="header-actions">
                    <button
                        class="secondary-button"
                        type="button"
                        onClick={() => exportShareLotsCsv(sortedRows)}
                    >
                        {hasActiveFilters ? 'Download filtered lots' : 'Download share lots'}
                    </button>
                    <button class="secondary-button" type="button" onClick={onBack}>Back to portfolio</button>
                </div>
            </header>

            <main class="content-panel">
                <div class="share-lots-filters">
                    <div class="share-lots-filters-header">
                        <h2>Filter share lots</h2>
                        <button type="button" class="link-button" onClick={clearFilters}>Clear filters</button>
                    </div>
                    <div class="form-grid">
                        <label class="field">
                            <span>Buy date from</span>
                            <input type="date" value={fromDate} onInput={(event) => setFromDate((event.target as HTMLInputElement).value)} />
                        </label>
                        <label class="field">
                            <span>Buy date to</span>
                            <input type="date" value={toDate} onInput={(event) => setToDate((event.target as HTMLInputElement).value)} />
                        </label>
                        <label class="field">
                            <span>Holding entity</span>
                            <select value={holdingEntityFilter} onInput={(event) => setHoldingEntityFilter((event.target as HTMLSelectElement).value)}>
                                <option value="">All holding entities</option>
                                {holdingEntities.map((entity) => <option value={entity} key={entity}>{entity}</option>)}
                            </select>
                        </label>
                        <label class="field">
                            <span>Share code</span>
                            <select value={codeFilter} onInput={(event) => setCodeFilter((event.target as HTMLSelectElement).value)}>
                                <option value="">All share codes</option>
                                {codes.map((code) => <option value={code} key={code}>{code}</option>)}
                            </select>
                        </label>
                        <label class="field">
                            <span>Status</span>
                            <select value={statusFilter} onInput={(event) => setStatusFilter((event.target as HTMLSelectElement).value as LotStatusFilter)}>
                                <option value="all">All statuses</option>
                                <option value="open">Open</option>
                                <option value="closed">Closed</option>
                            </select>
                        </label>
                    </div>
                    <p class="share-lots-filter-count">Showing {sortedRows.length} of {rows.length} share lots</p>
                </div>

                <div class="share-lots-table-wrapper">
                    <table class="share-lots-table">
                        <thead>
                            <tr>
                                <th>
                                    <button type="button" class="sort-button" onClick={() => updateSort('buyDate')}>
                                        Buy date
                                    </button>
                                </th>
                                <th>
                                    <button type="button" class="sort-button" onClick={() => updateSort('code')}>
                                        Code
                                    </button>
                                </th>
                                <th>
                                    <button type="button" class="sort-button" onClick={() => updateSort('holdingEntity')}>
                                        Holding entity
                                    </button>
                                </th>
                                <th>
                                    <button type="button" class="sort-button" onClick={() => updateSort('unitCount')}>
                                        Units
                                    </button>
                                </th>
                                <th>
                                    <button type="button" class="sort-button" onClick={() => updateSort('unitOriginalCost')}>
                                        Unit cost
                                    </button>
                                </th>
                                <th>
                                    <button type="button" class="sort-button" onClick={() => updateSort('unitCurrentCost')}>
                                        Current cost
                                    </button>
                                </th>
                                <th>
                                    <button type="button" class="sort-button" onClick={() => updateSort('isOpen')}>
                                        Status
                                    </button>
                                </th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedRows.map((row) => {
                                const isExpanded = expandedLotIds.includes(row.lot.id);
                                const buyTransaction = row.buyTransaction;

                                return (
                                    <>
                                        <tr key={row.lot.id}>
                                            <td>{formatDate(buyTransaction?.transactionTimestamp)}</td>
                                            <td>{row.lot.code}</td>
                                            <td>{row.lot.holdingEntity}</td>
                                            <td>{row.lot.unitCount}</td>
                                            <td>{currencyFormatter.format(Number(row.lot.unitOriginalCost ?? 0))}</td>
                                            <td>{currencyFormatter.format(Number(row.lot.unitCurrentCost ?? 0))}</td>
                                            <td>{row.lot.isOpen === false ? 'Closed' : 'Open'}</td>
                                            <td class="table-actions">
                                                <button
                                                    type="button"
                                                    class="secondary-button"
                                                    onClick={() => toggleExpandedLot(row.lot.id)}
                                                >
                                                    {isExpanded ? 'Hide transactions' : 'Show transactions'}
                                                </button>
                                                {!row.linkedTransactions.some(({ transaction }) => transaction?.type === 'sell') ? (
                                                    <button
                                                        type="button"
                                                        class="danger-button"
                                                        onClick={() => {
                                                            const confirmed = window.confirm(`Delete share lot ${row.lot.id} and its related buy/sell records?`);
                                                            if (confirmed) {
                                                                onDeleteShareLot(row.lot.id);
                                                            }
                                                        }}
                                                    >
                                                        Delete
                                                    </button>
                                                ) : null}
                                            </td>
                                        </tr>
                                        {isExpanded ? (
                                            <tr class="expanded-row" key={`${row.lot.id}-details`}>
                                                <td colSpan={8}>
                                                    <div class="share-lot-details">
                                                        <div class="share-lot-details-header">
                                                            <h3>Buy transaction details</h3>
                                                            {buyTransaction ? (
                                                                <span>
                                                                    {buyTransaction.documentRef} · {currencyFormatter.format(Number(buyTransaction.unitPrice ?? 0))} / unit
                                                                </span>
                                                            ) : null}
                                                        </div>

                                                        {buyTransaction ? (
                                                            <div class="transaction-detail-grid">
                                                                <div><strong>Transaction ID</strong><span>{buyTransaction.id}</span></div>
                                                                <div><strong>Timestamp</strong><span>{formatDate(buyTransaction.transactionTimestamp)}</span></div>
                                                                <div><strong>Unit count</strong><span>{buyTransaction.unitCount}</span></div>
                                                                <div><strong>Unit price</strong><span>{currencyFormatter.format(Number(buyTransaction.unitPrice ?? 0))}</span></div>
                                                                <div><strong>Fees</strong><span>{currencyFormatter.format(Number(buyTransaction.fees ?? 0))}</span></div>
                                                                <div><strong>Notes</strong><span>{buyTransaction.notes || '—'}</span></div>
                                                            </div>
                                                        ) : (
                                                            <div class="empty-state">Buy transaction details unavailable.</div>
                                                        )}

                                                        <div class="share-lot-transactions">
                                                            <h4>Linked transactions</h4>
                                                            {row.linkedTransactions.length ? (
                                                                <table class="nested-table">
                                                                    <thead>
                                                                        <tr>
                                                                            <th>Type</th>
                                                                            <th>Transaction date</th>
                                                                            <th>Units</th>
                                                                            <th>Unit price</th>
                                                                            <th>Unit count delta</th>
                                                                            <th>Unit cost delta</th>
                                                                            <th>Fees</th>
                                                                            <th>Document ref</th>
                                                                            <th>Notes</th>
                                                                            <th>Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {row.linkedTransactions.map(({ shareLotTransaction, transaction }) => {
                                                                            const displayedUnits = transaction?.type === 'etf-tax-statement'
                                                                                ? (typeof transaction.unitCount === 'number' ? transaction.unitCount : shareLotTransaction.unitCount)
                                                                                : shareLotTransaction.unitCount;

                                                                            return (
                                                                                <tr key={`${row.lot.id}-${shareLotTransaction.id}`}>
                                                                                    <td>{transaction?.type ?? 'Unknown'}</td>
                                                                                    <td>{formatDate(transaction?.transactionTimestamp)}</td>
                                                                                    <td>{displayedUnits}</td>
                                                                                    <td>{transaction ? currencyFormatter.format(Number(transaction.unitPrice ?? 0)) : '—'}</td>
                                                                                    <td>{typeof transaction?.unitCountDelta === 'number' ? transaction.unitCountDelta : '—'}</td>
                                                                                    <td>{typeof transaction?.unitCostDelta === 'number' ? currencyFormatter.format(Number(transaction.unitCostDelta ?? 0)) : '—'}</td>
                                                                                    <td>{transaction ? currencyFormatter.format(Number(transaction.fees ?? 0)) : '—'}</td>
                                                                                    <td>{transaction?.documentRef || '—'}</td>
                                                                                    <td>{transaction?.notes || '—'}</td>
                                                                                    <td>
                                                                                        {transaction?.type === 'sell' ? (
                                                                                            <button
                                                                                                type="button"
                                                                                                class="danger-button"
                                                                                                onClick={() => {
                                                                                                    const confirmed = window.confirm(`Delete sell transaction ${transaction.id}? This will reopen all share lots affected by it.`);
                                                                                                    if (confirmed) {
                                                                                                        onDeleteSellTransaction(transaction.id);
                                                                                                    }
                                                                                                }}
                                                                                            >
                                                                                                Delete sell transaction
                                                                                            </button>
                                                                                        ) : null}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            ) : (
                                                                <div class="empty-state">No linked transactions found.</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : null}
                                    </>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
