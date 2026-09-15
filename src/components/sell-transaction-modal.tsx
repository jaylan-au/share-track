import { ComponentChildren } from 'preact';
import { SellTransactionFormState } from '../types';

interface SellTransactionModalProps {
    form: SellTransactionFormState;
    securities: any[];
    holdingEntities: any[];
    isOpen: boolean;
    onClose: () => void;
    onFieldChange: (field: keyof SellTransactionFormState, value: string) => void;
    onUpdateLotAllocation: (shareLotId: string, unitCount: string) => void;
    onAssignAllUnitsToLot: (shareLotId: string) => void;
    onSubmit: (event: Event) => void;
    totalAllocatedUnits: number;
    sellUnitCount: number;
    isAllocationValid: boolean;
}

export function SellTransactionModal({
    form,
    securities,
    holdingEntities,
    isOpen,
    onClose,
    onFieldChange,
    onUpdateLotAllocation,
    onAssignAllUnitsToLot,
    onSubmit,
    totalAllocatedUnits,
    sellUnitCount,
    isAllocationValid,
}: SellTransactionModalProps): ComponentChildren {
    if (!isOpen) {
        return null;
    }

    const unitCount = Number(form.unitCount);
    const unitPrice = Number(form.unitPrice);
    const fees = Number(form.fees || 0);
    const totalValue = Number.isFinite(unitCount) && Number.isFinite(unitPrice) && Number.isFinite(fees)
        ? (unitCount * unitPrice) + fees
        : null;

    return (
        <div class="modal-backdrop" onClick={onClose}>
            <div class="modal-dialog" onClick={(event) => event.stopPropagation()}>
                <div class="modal-header">
                    <h2>Add sell transaction</h2>
                    <button class="icon-button" type="button" onClick={onClose}>×</button>
                </div>

                <form class="transaction-form" onSubmit={onSubmit}>
                    <div class="form-grid">
                        <label class="field">
                            <span>Security</span>
                            <select value={form.code} onInput={(event) => onFieldChange('code', (event.target as HTMLSelectElement).value)}>
                                {securities.map((security) => (
                                    <option value={security.code} key={security.id}>{security.code}</option>
                                ))}
                            </select>
                        </label>

                        <label class="field">
                            <span>Holding entity</span>
                            <select value={form.holdingEntity} onInput={(event) => onFieldChange('holdingEntity', (event.target as HTMLSelectElement).value)}>
                                {holdingEntities.map((entity) => (
                                    <option value={entity.id} key={entity.id}>{entity.name}</option>
                                ))}
                            </select>
                        </label>

                        <label class="field">
                            <span>Units to sell</span>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={form.unitCount}
                                onInput={(event) => onFieldChange('unitCount', (event.target as HTMLInputElement).value)}
                            />
                        </label>

                        <label class="field">
                            <span>Sell price</span>
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={form.unitPrice}
                                onInput={(event) => onFieldChange('unitPrice', (event.target as HTMLInputElement).value)}
                            />
                        </label>

                        <label class="field">
                            <span>Fees</span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.fees}
                                onInput={(event) => onFieldChange('fees', (event.target as HTMLInputElement).value)}
                            />
                        </label>

                        <label class="field">
                            <span>Transaction date</span>
                            <input
                                type="date"
                                value={form.transactionDate}
                                onInput={(event) => onFieldChange('transactionDate', (event.target as HTMLInputElement).value)}
                            />
                        </label>

                        <div class="field calculated-field">
                            <span>Total transaction value</span>
                            <strong>{totalValue === null ? '-' : `$${totalValue.toFixed(2)}`}</strong>
                        </div>

                        <label class="field">
                            <span>Document Reference</span>
                            <input
                                type="text"
                                value={form.documentRef}
                                onInput={(event) => onFieldChange('documentRef', (event.target as HTMLInputElement).value)}
                            />
                        </label>
                    </div>

                    <div class="lot-allocation-panel">
                        <h3>Allocate units to share lots</h3>

                        {form.lotAllocations.length ? (
                            form.lotAllocations.map((allocation) => (
                                <div class="lot-allocation-row" key={allocation.shareLotId}>
                                    <div class="lot-allocation-meta">
                                        <div class="lot-allocation-text">
                                            <strong>{allocation.label}</strong>
                                            <span class="lot-allocation-details">{allocation.shareLotId}</span>
                                        </div>
                                    </div>
                                    <label class="field compact-field">
                                        <span>Units</span>
                                        <input
                                            type="number"
                                            min="0"
                                            max={allocation.availableUnits}
                                            step="1"
                                            value={allocation.unitCount}
                                            onInput={(event) => onUpdateLotAllocation(allocation.shareLotId, (event.target as HTMLInputElement).value)}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        class="link-button"
                                        onClick={() => onAssignAllUnitsToLot(allocation.shareLotId)}
                                    >
                                        Assign all
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div class="empty-state">No open share lots available for the selected security and entity.</div>
                        )}

                        <div class="lot-allocation-summary">
                            <div class="lot-allocation-summary-row">
                                <span>Total allocation</span>
                                <strong>{totalAllocatedUnits} / {sellUnitCount || '0'} units</strong>
                            </div>
                            <div class={
                                `allocation-status ${isAllocationValid ? 'allocation-status-valid' : sellUnitCount ? 'allocation-status-invalid' : ''}`.trim()
                            }>
                                {sellUnitCount
                                    ? (isAllocationValid
                                        ? 'Allocation matches the units being sold.'
                                        : 'Allocation must match the units being sold exactly.')
                                    : 'Enter the number of units being sold to begin allocation.'}
                            </div>
                        </div>
                    </div>

                    <label class="field full-width">
                        <span>Notes</span>
                        <textarea
                            rows={3}
                            value={form.notes}
                            onInput={(event) => onFieldChange('notes', (event.target as HTMLTextAreaElement).value)}
                        />
                    </label>

                    <div class="form-actions">
                        <button type="button" class="secondary-button" onClick={onClose}>Cancel</button>
                        <button type="submit" class="submit-button">Save sell transaction</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
