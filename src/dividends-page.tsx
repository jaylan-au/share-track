import { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { HoldingEntity, ShareLot, ShareLotTransaction, ShareSecurity, ShareTransaction } from './model/data-model';
import { DividendTransactionInput, EtfTaxStatementTransactionInput } from './types';

interface DividendsPageProps {
    dividends: ShareTransaction[];
    shareLots: ShareLot[];
    shareLotTransactions: ShareLotTransaction[];
    securities: ShareSecurity[];
    holdingEntities: HoldingEntity[];
    hasUnsavedChanges: boolean;
    onAddDividend: (input: DividendTransactionInput) => void;
    onAddEtfTaxStatement: (input: EtfTaxStatementTransactionInput) => void;
    onPreviewEtfTaxStatement: (transactionId: string) => {
        affectedLots: Array<{
            lot: ShareLot;
            unitCount: number;
            unitCurrentCost: number;
            buyDate?: number;
            isClosed: boolean;
            closedDate?: number | null;
        }>;
        totalUnits: number;
        unitCostDelta: number;
        unitCurrentCostAdjustment: number;
    } | null;
    onFinalizeEtfTaxStatement: (transactionId: string) => void;
    onDeleteDividend: (dividendTransactionId: string) => void;
    onBack: () => void;
}

interface DividendFormState {
    code: string;
    holdingEntity: string;
    dividendPerShare: string;
    numberOfSecurities: string;
    totalFrankedAmount: string;
    totalUnfrankedAmount: string;
    totalFrankingCredit: string;
    originalCurrency: string;
    transactionDate: string;
    cutOffDate: string;
    documentRef: string;
    notes: string;
}

interface EtfTaxStatementFormState {
    code: string;
    holdingEntity: string;
    unitCostDelta: string;
    originalCurrency: string;
    transactionDate: string;
    cutOffDate: string;
    documentRef: string;
}

interface EtfTaxStatementFinalizationPlan {
    affectedLots: Array<{
        lot: ShareLot;
        unitCount: number;
        unitCurrentCost: number;
        buyDate?: number;
        isClosed: boolean;
        closedDate?: number | null;
    }>;
    totalUnits: number;
    unitCostDelta: number;
    unitCurrentCostAdjustment: number;
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

function getCurrentDateString(): string {
    return new Date().toISOString().slice(0, 10);
}

function formatDate(timestamp?: number): string {
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
        return '—';
    }

    return dateFormatter.format(new Date(timestamp));
}

function createEmptyDividendForm(securities: ShareSecurity[], holdingEntities: HoldingEntity[]): DividendFormState {
    return {
        code: String(securities[0]?.code ?? ''),
        holdingEntity: String(holdingEntities[0]?.id ?? ''),
        dividendPerShare: '',
        numberOfSecurities: '',
        totalFrankedAmount: '',
        totalUnfrankedAmount: '',
        totalFrankingCredit: '',
        originalCurrency: 'AUD',
        transactionDate: getCurrentDateString(),
        cutOffDate: getCurrentDateString(),
        documentRef: '',
        notes: '',
    };
}

function createEmptyEtfTaxStatementForm(securities: ShareSecurity[], holdingEntities: HoldingEntity[]): EtfTaxStatementFormState {
    return {
        code: String(securities[0]?.code ?? ''),
        holdingEntity: String(holdingEntities[0]?.id ?? ''),
        unitCostDelta: '',
        originalCurrency: 'AUD',
        transactionDate: getCurrentDateString(),
        cutOffDate: getCurrentDateString(),
        documentRef: '',
    };
}

export function DividendsPage({
    dividends,
    shareLots,
    shareLotTransactions,
    securities,
    holdingEntities,
    hasUnsavedChanges,
    onAddDividend,
    onAddEtfTaxStatement,
    onPreviewEtfTaxStatement,
    onFinalizeEtfTaxStatement,
    onDeleteDividend,
    onBack,
}: DividendsPageProps): ComponentChildren {
    const [isDividendModalOpen, setIsDividendModalOpen] = useState(false);
    const [isEtfTaxStatementModalOpen, setIsEtfTaxStatementModalOpen] = useState(false);
    const [isFinalizationModalOpen, setIsFinalizationModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dividendForm, setDividendForm] = useState<DividendFormState>(() => createEmptyDividendForm(securities, holdingEntities));
    const [etfTaxStatementForm, setEtfTaxStatementForm] = useState<EtfTaxStatementFormState>(() => createEmptyEtfTaxStatementForm(securities, holdingEntities));
    const [finalizationPlan, setFinalizationPlan] = useState<EtfTaxStatementFinalizationPlan | null>(null);
    const [finalizingTransactionId, setFinalizingTransactionId] = useState<string | null>(null);
    const [finalizingTransaction, setFinalizingTransaction] = useState<ShareTransaction | null>(null);

    const sortedDividends = [...dividends]
        .filter((transaction) => transaction.type === 'dividend' || transaction.type === 'etf-tax-statement')
        .sort((left, right) => (right.transactionTimestamp ?? 0) - (left.transactionTimestamp ?? 0));

    const updateDividendFormField = (field: keyof DividendFormState, value: string): void => {
        setDividendForm((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const updateEtfTaxStatementFormField = (field: keyof EtfTaxStatementFormState, value: string): void => {
        setEtfTaxStatementForm((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const resetDividendForm = (): void => {
        setDividendForm(createEmptyDividendForm(securities, holdingEntities));
    };

    const resetEtfTaxStatementForm = (): void => {
        setEtfTaxStatementForm(createEmptyEtfTaxStatementForm(securities, holdingEntities));
    };

    const openDividendModal = (): void => {
        setError(null);
        setDividendForm(createEmptyDividendForm(securities, holdingEntities));
        setIsDividendModalOpen(true);
    };

    const closeDividendModal = (): void => {
        setIsDividendModalOpen(false);
        setError(null);
    };

    const openEtfTaxStatementModal = (): void => {
        setError(null);
        setEtfTaxStatementForm(createEmptyEtfTaxStatementForm(securities, holdingEntities));
        setIsEtfTaxStatementModalOpen(true);
    };

    const closeEtfTaxStatementModal = (): void => {
        setIsEtfTaxStatementModalOpen(false);
        setError(null);
    };

    const openEtfFinalizationModal = (transactionId: string): void => {
        const transaction = sortedDividends.find((entry) => entry.id === transactionId) ?? null;
        const plan = onPreviewEtfTaxStatement(transactionId);

        if (!plan || !transaction) {
            setError('Unable to calculate ETF finalization plan.');
            return;
        }

        setFinalizationPlan(plan);
        setFinalizingTransactionId(transactionId);
        setFinalizingTransaction(transaction);
        setIsFinalizationModalOpen(true);
        setError(null);
    };

    const closeEtfFinalizationModal = (): void => {
        setIsFinalizationModalOpen(false);
        setFinalizationPlan(null);
        setFinalizingTransactionId(null);
        setFinalizingTransaction(null);
        setError(null);
    };

    const submitDividend = (event: Event): void => {
        event.preventDefault();

        const parsedDividendPerShare = Number(dividendForm.dividendPerShare);
        const parsedNumberOfSecurities = Number(dividendForm.numberOfSecurities);
        const parsedTotalFrankedAmount = Number(dividendForm.totalFrankedAmount);
        const parsedTotalUnfrankedAmount = Number(dividendForm.totalUnfrankedAmount);
        const parsedTotalFrankingCredit = Number(dividendForm.totalFrankingCredit);

        if (!dividendForm.code.trim() || !dividendForm.holdingEntity || !dividendForm.transactionDate) {
            setError('Please provide a security, holding entity, and transaction date.');
            return;
        }

        if (!Number.isFinite(parsedDividendPerShare) || parsedDividendPerShare < 0) {
            setError('Please provide a valid dividend per share value.');
            return;
        }

        if (!Number.isFinite(parsedNumberOfSecurities) || parsedNumberOfSecurities <= 0) {
            setError('Please provide a valid number of securities.');
            return;
        }

        if (!Number.isFinite(parsedTotalFrankedAmount) || parsedTotalFrankedAmount < 0) {
            setError('Please provide a valid total franked amount.');
            return;
        }

        if (!Number.isFinite(parsedTotalUnfrankedAmount) || parsedTotalUnfrankedAmount < 0) {
            setError('Please provide a valid total unfranked amount.');
            return;
        }

        if (!Number.isFinite(parsedTotalFrankingCredit) || parsedTotalFrankingCredit < 0) {
            setError('Please provide a valid total franking credit.');
            return;
        }

        onAddDividend({
            code: dividendForm.code.trim(),
            holdingEntity: dividendForm.holdingEntity,
            dividendPerShare: parsedDividendPerShare,
            numberOfSecurities: parsedNumberOfSecurities,
            totalFrankedAmount: parsedTotalFrankedAmount,
            totalUnfrankedAmount: parsedTotalUnfrankedAmount,
            totalFrankingCredit: parsedTotalFrankingCredit,
            originalCurrency: dividendForm.originalCurrency.trim() || 'AUD',
            transactionDate: dividendForm.transactionDate,
            cutOffDate: dividendForm.cutOffDate,
            documentRef: dividendForm.documentRef.trim(),
            notes: dividendForm.notes,
        });

        closeDividendModal();
        resetDividendForm();
    };

    const submitEtfTaxStatement = (event: Event): void => {
        event.preventDefault();

        const parsedUnitCostDelta = Number(etfTaxStatementForm.unitCostDelta);

        if (!etfTaxStatementForm.code.trim() || !etfTaxStatementForm.holdingEntity || !etfTaxStatementForm.transactionDate) {
            setError('Please provide a security, holding entity, and transaction date.');
            return;
        }

        if (!Number.isFinite(parsedUnitCostDelta)) {
            setError('Please provide a valid unit cost delta.');
            return;
        }

        onAddEtfTaxStatement({
            code: etfTaxStatementForm.code.trim(),
            holdingEntity: etfTaxStatementForm.holdingEntity,
            unitCostDelta: parsedUnitCostDelta,
            originalCurrency: etfTaxStatementForm.originalCurrency.trim() || 'AUD',
            transactionDate: etfTaxStatementForm.transactionDate,
            cutOffDate: etfTaxStatementForm.cutOffDate,
            documentRef: etfTaxStatementForm.documentRef.trim(),
        });

        closeEtfTaxStatementModal();
        resetEtfTaxStatementForm();
    };

    return (
        <div class="app-shell">
            <header class="app-header">
                <div>
                    <p class="eyebrow">ShareTrack</p>
                    <h1>Dividends</h1>
                    {hasUnsavedChanges ? <span class="unsaved-changes">Unsaved changes</span> : null}
                </div>
                <div class="header-actions">
                    <button class="primary-button" type="button" onClick={openDividendModal}>
                        Add dividend
                    </button>
                    <button class="secondary-button" type="button" onClick={openEtfTaxStatementModal}>
                        Add ETF Tax Statement
                    </button>
                    <button class="secondary-button" type="button" onClick={onBack}>
                        Back to portfolio
                    </button>
                </div>
            </header>

            <main class="content-panel">
                {error ? (
                    <div class="error-message">{error}</div>
                ) : null}

                <div class="share-lots-table-wrapper">
                    {sortedDividends.length ? (
                        <table class="share-lots-table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Transaction date</th>
                                    <th>Code</th>
                                    <th>Holding entity</th>
                                    <th>Unit cost delta</th>
                                    <th>Dividend per share</th>
                                    <th>Number of securities</th>
                                    <th>Total franked amount</th>
                                    <th>Total unfranked amount</th>
                                    <th>Total franking credit</th>
                                    <th>Original currency</th>
                                    <th>Cut off date</th>
                                    <th>Document ref</th>
                                    <th>Notes</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedDividends.map((transaction) => (
                                    <tr key={transaction.id}>
                                        <td>{transaction.type === 'etf-tax-statement' ? 'ETF Tax Statement' : 'Dividend'}</td>
                                        <td>{formatDate(transaction.transactionTimestamp)}</td>
                                        <td>{transaction.code}</td>
                                        <td>{transaction.holdingEntity}</td>
                                        <td>{typeof transaction.unitCostDelta === 'number' ? currencyFormatter.format(transaction.unitCostDelta) : '—'}</td>
                                        <td>{typeof transaction.dividendPerShare === 'number' ? currencyFormatter.format(transaction.dividendPerShare) : '—'}</td>
                                        <td>{typeof transaction.numberOfSecurities === 'number' ? transaction.numberOfSecurities : '—'}</td>
                                        <td>{typeof transaction.totalFrankedAmount === 'number' ? currencyFormatter.format(transaction.totalFrankedAmount) : '—'}</td>
                                        <td>{typeof transaction.totalUnfrankedAmount === 'number' ? currencyFormatter.format(transaction.totalUnfrankedAmount) : '—'}</td>
                                        <td>{typeof transaction.totalFrankingCredit === 'number' ? currencyFormatter.format(transaction.totalFrankingCredit) : '—'}</td>
                                        <td>{transaction.originalCurrency || 'AUD'}</td>
                                        <td>{formatDate(transaction.cutOffDate)}</td>
                                        <td>{transaction.documentRef || '—'}</td>
                                        <td>{transaction.notes || '—'}</td>
                                        <td class="table-actions">
                                            {transaction.type === 'etf-tax-statement' ? (
                                                transaction.finalized ? (
                                                    <span>Finalised</span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        class="secondary-button"
                                                        onClick={() => openEtfFinalizationModal(String(transaction.id))}
                                                    >
                                                        Finalise
                                                    </button>
                                                )
                                            ) : null}
                                            <button
                                                type="button"
                                                class="danger-button"
                                                onClick={() => {
                                                    const confirmed = window.confirm(`Delete ${transaction.type === 'etf-tax-statement' ? 'ETF Tax Statement' : 'dividend'} transaction ${transaction.id}?`);
                                                    if (confirmed) {
                                                        onDeleteDividend(String(transaction.id));
                                                    }
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div class="empty-state">No dividend transactions found.</div>
                    )}
                </div>
            </main>

            {isDividendModalOpen ? (
                <div class="modal-backdrop" onClick={closeDividendModal}>
                    <div class="modal-dialog" onClick={(event) => event.stopPropagation()}>
                        <div class="modal-header">
                            <h2>Add dividend transaction</h2>
                            <button class="icon-button" type="button" onClick={closeDividendModal}>×</button>
                        </div>

                        <form class="transaction-form" onSubmit={submitDividend}>
                            <div class="form-grid">
                                <label class="field">
                                    <span>Security</span>
                                    <select value={dividendForm.code} onInput={(event) => updateDividendFormField('code', (event.target as HTMLSelectElement).value)}>
                                        {securities.map((security) => (
                                            <option value={security.code} key={security.id}>{security.code}</option>
                                        ))}
                                    </select>
                                </label>

                                <label class="field">
                                    <span>Holding entity</span>
                                    <select value={dividendForm.holdingEntity} onInput={(event) => updateDividendFormField('holdingEntity', (event.target as HTMLSelectElement).value)}>
                                        {holdingEntities.map((entity) => (
                                            <option value={entity.id} key={entity.id}>{entity.name}</option>
                                        ))}
                                    </select>
                                </label>

                                <label class="field">
                                    <span>Dividend per share</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={dividendForm.dividendPerShare}
                                        onInput={(event) => updateDividendFormField('dividendPerShare', (event.target as HTMLInputElement).value)}
                                    />
                                </label>

                                <label class="field">
                                    <span>Number of securities</span>
                                    <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={dividendForm.numberOfSecurities}
                                        onInput={(event) => updateDividendFormField('numberOfSecurities', (event.target as HTMLInputElement).value)}
                                    />
                                </label>

                                <label class="field">
                                    <span>Total franked amount</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={dividendForm.totalFrankedAmount}
                                        onInput={(event) => updateDividendFormField('totalFrankedAmount', (event.target as HTMLInputElement).value)}
                                    />
                                </label>

                                <label class="field">
                                    <span>Total unfranked amount</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={dividendForm.totalUnfrankedAmount}
                                        onInput={(event) => updateDividendFormField('totalUnfrankedAmount', (event.target as HTMLInputElement).value)}
                                    />
                                </label>

                                <label class="field">
                                    <span>Transaction date</span>
                                    <input
                                        type="date"
                                        value={dividendForm.transactionDate}
                                        onInput={(event) => updateDividendFormField('transactionDate', (event.target as HTMLInputElement).value)}
                                    />
                                </label>

                                <label class="field">
                                    <span>Cut off date</span>
                                    <input
                                        type="date"
                                        value={dividendForm.cutOffDate}
                                        onInput={(event) => updateDividendFormField('cutOffDate', (event.target as HTMLInputElement).value)}
                                    />
                                </label>

                                <label class="field">
                                    <span>Total franking credit</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={dividendForm.totalFrankingCredit}
                                        onInput={(event) => updateDividendFormField('totalFrankingCredit', (event.target as HTMLInputElement).value)}
                                    />
                                </label>

                                <label class="field">
                                    <span>Original currency</span>
                                    <input
                                        type="text"
                                        value={dividendForm.originalCurrency}
                                        onInput={(event) => updateDividendFormField('originalCurrency', (event.target as HTMLInputElement).value)}
                                    />
                                </label>

                                <label class="field">
                                    <span>Document Reference</span>
                                    <input
                                        type="text"
                                        value={dividendForm.documentRef}
                                        onInput={(event) => updateDividendFormField('documentRef', (event.target as HTMLInputElement).value)}
                                    />
                                </label>
                            </div>

                            <label class="field full-width">
                                <span>Notes</span>
                                <textarea
                                    rows={3}
                                    value={dividendForm.notes}
                                    onInput={(event) => updateDividendFormField('notes', (event.target as HTMLTextAreaElement).value)}
                                />
                            </label>

                            <div class="form-actions">
                                <button type="button" class="secondary-button" onClick={closeDividendModal}>Cancel</button>
                                <button type="submit" class="submit-button">Save dividend</button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {isEtfTaxStatementModalOpen ? (
                <div class="modal-backdrop" onClick={closeEtfTaxStatementModal}>
                    <div class="modal-dialog" onClick={(event) => event.stopPropagation()}>
                        <div class="modal-header">
                            <h2>Add ETF Tax Statement</h2>
                            <button class="icon-button" type="button" onClick={closeEtfTaxStatementModal}>×</button>
                        </div>

                        <form class="transaction-form" onSubmit={submitEtfTaxStatement}>
                            <div class="form-grid">
                                <label class="field">
                                    <span>Security</span>
                                    <select value={etfTaxStatementForm.code} onInput={(event) => updateEtfTaxStatementFormField('code', (event.target as HTMLSelectElement).value)}>
                                        {securities.map((security) => (
                                            <option value={security.code} key={security.id}>{security.code}</option>
                                        ))}
                                    </select>
                                </label>

                                <label class="field">
                                    <span>Holding entity</span>
                                    <select value={etfTaxStatementForm.holdingEntity} onInput={(event) => updateEtfTaxStatementFormField('holdingEntity', (event.target as HTMLSelectElement).value)}>
                                        {holdingEntities.map((entity) => (
                                            <option value={entity.id} key={entity.id}>{entity.name}</option>
                                        ))}
                                    </select>
                                </label>

                                <label class="field">
                                    <span>UnitCostDelta</span>
                                    <input
                                        type="number"
                                        min="-99999999"
                                        step="0.01"
                                        value={etfTaxStatementForm.unitCostDelta}
                                        onInput={(event) => updateEtfTaxStatementFormField('unitCostDelta', (event.target as HTMLInputElement).value)}
                                    />
                                </label>

                                <label class="field">
                                    <span>Document Reference</span>
                                    <input
                                        type="text"
                                        value={etfTaxStatementForm.documentRef}
                                        onInput={(event) => updateEtfTaxStatementFormField('documentRef', (event.target as HTMLInputElement).value)}
                                    />
                                </label>

                                <label class="field">
                                    <span>Original currency</span>
                                    <input
                                        type="text"
                                        value={etfTaxStatementForm.originalCurrency}
                                        onInput={(event) => updateEtfTaxStatementFormField('originalCurrency', (event.target as HTMLInputElement).value)}
                                    />
                                </label>

                                <label class="field">
                                    <span>Transaction date</span>
                                    <input
                                        type="date"
                                        value={etfTaxStatementForm.transactionDate}
                                        onInput={(event) => updateEtfTaxStatementFormField('transactionDate', (event.target as HTMLInputElement).value)}
                                    />
                                </label>

                                <label class="field">
                                    <span>Cut off date</span>
                                    <input
                                        type="date"
                                        value={etfTaxStatementForm.cutOffDate}
                                        onInput={(event) => updateEtfTaxStatementFormField('cutOffDate', (event.target as HTMLInputElement).value)}
                                    />
                                </label>
                            </div>

                            <div class="form-actions">
                                <button type="button" class="secondary-button" onClick={closeEtfTaxStatementModal}>Cancel</button>
                                <button type="submit" class="submit-button">Save ETF Tax Statement</button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : null}

            {isFinalizationModalOpen && finalizationPlan ? (
                <div class="modal-backdrop" onClick={closeEtfFinalizationModal}>
                    <div class="modal-dialog" onClick={(event) => event.stopPropagation()}>
                        <div class="modal-header">
                            <h2>Finalise ETF Tax Statement</h2>
                            <button class="icon-button" type="button" onClick={closeEtfFinalizationModal}>×</button>
                        </div>

                        <div class="transaction-form">
                            <div class="form-grid">
                                <label class="field">
                                    <span>Security</span>
                                    <input type="text" value={finalizingTransaction?.code ?? ''} readOnly />
                                </label>

                                <label class="field">
                                    <span>Holding entity</span>
                                    <input type="text" value={finalizingTransaction?.holdingEntity ?? ''} readOnly />
                                </label>

                                <label class="field">
                                    <span>Transaction date</span>
                                    <input type="text" value={finalizingTransaction ? formatDate(finalizingTransaction.transactionTimestamp) : ''} readOnly />
                                </label>

                                <label class="field">
                                    <span>Cut off date</span>
                                    <input type="text" value={finalizingTransaction ? formatDate(finalizingTransaction.cutOffDate) : ''} readOnly />
                                </label>

                                <label class="field">
                                    <span>Document reference</span>
                                    <input type="text" value={finalizingTransaction?.documentRef ?? ''} readOnly />
                                </label>

                                <label class="field">
                                    <span>Original currency</span>
                                    <input type="text" value={finalizingTransaction?.originalCurrency ?? 'AUD'} readOnly />
                                </label>

                                <label class="field">
                                    <span>ETF total unit cost delta</span>
                                    <input type="text" value={currencyFormatter.format(finalizationPlan.unitCostDelta)} readOnly />
                                </label>

                                <label class="field">
                                    <span>Total affected units</span>
                                    <input type="text" value={String(finalizationPlan.totalUnits)} readOnly />
                                </label>

                                <label class="field">
                                    <span>UnitCurrentCost Adjustment (per share)</span>
                                    <input type="text" value={currencyFormatter.format(finalizationPlan.unitCurrentCostAdjustment)} readOnly />
                                </label>
                            </div>

                            <div>
                                <h3>Affected share lots</h3>
                                <table class="share-lots-table">
                                    <thead>
                                        <tr>
                                            <th>Share lot ID</th>
                                            <th>Code</th>
                                            <th>Holding entity</th>
                                            <th>Original buy date</th>
                                            <th>Status</th>
                                            <th>Closed date</th>
                                            <th>Units</th>
                                            <th>Current cost</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {finalizationPlan.affectedLots.map((entry) => (
                                            <tr key={entry.lot.id}>
                                                <td>{entry.lot.id}</td>
                                                <td>{entry.lot.code}</td>
                                                <td>{entry.lot.holdingEntity}</td>
                                                <td>{formatDate(entry.buyDate)}</td>
                                                <td>{entry.isClosed ? 'Closed' : 'Open'}</td>
                                                <td>{entry.isClosed ? formatDate(entry.closedDate ?? undefined) : '—'}</td>
                                                <td>{entry.unitCount}</td>
                                                <td>{currencyFormatter.format(entry.unitCurrentCost)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div class="form-actions">
                                <button type="button" class="secondary-button" onClick={closeEtfFinalizationModal}>Cancel</button>
                                <button
                                    type="button"
                                    class="submit-button"
                                    onClick={() => {
                                        if (finalizingTransactionId) {
                                            onFinalizeEtfTaxStatement(finalizingTransactionId);
                                        }
                                        closeEtfFinalizationModal();
                                    }}
                                >
                                    Finalise
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
