import { ComponentChildren, JSX } from 'preact';
import { BuyTransactionFormState } from '../types';
import { formatCurrency } from '../model/formatters';

interface BuyTransactionModalProps {
    form: BuyTransactionFormState;
    securities: any[];
    holdingEntities: any[];
    isOpen: boolean;
    onClose: () => void;
    onFieldChange: (field: keyof BuyTransactionFormState, value: string) => void;
    onToggleSecurityMode: (isAddingNewSecurity: boolean) => void;
    onSubmit: (event: Event) => void;
}

export function BuyTransactionModal({
    form,
    securities,
    holdingEntities,
    isOpen,
    onClose,
    onFieldChange,
    onToggleSecurityMode,
    onSubmit,
}: BuyTransactionModalProps): ComponentChildren {
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
                    <h2>Add buy transaction</h2>
                    <button class="icon-button" type="button" onClick={onClose}>×</button>
                </div>

                <form class="transaction-form" onSubmit={onSubmit}>
                    <label class="toggle-field">
                        <input
                            type="checkbox"
                            checked={form.isAddingNewSecurity}
                            onChange={(event) => onToggleSecurityMode((event.target as HTMLInputElement).checked)}
                        />
                        <span>Add a security not already in the list</span>
                    </label>

                    <div class="form-grid">
                        {!form.isAddingNewSecurity ? (
                            <label class="field">
                                <span>Security</span>
                                <select value={form.code} onInput={(event) => onFieldChange('code', (event.target as HTMLSelectElement).value)}>
                                    {securities.map((security) => (
                                        <option value={security.code} key={security.id}>{security.code}</option>
                                    ))}
                                </select>
                            </label>
                        ) : (
                            <label class="field">
                                <span>Security</span>
                                <input
                                    type="text"
                                    value={form.newSecurityCode}
                                    placeholder="e.g. ASX:XYZ"
                                    onInput={(event) => onFieldChange('newSecurityCode', (event.target as HTMLInputElement).value)}
                                />
                            </label>
                        )}

                        <label class="field">
                            <span>Holding entity</span>
                            <select value={form.holdingEntity} onInput={(event) => onFieldChange('holdingEntity', (event.target as HTMLSelectElement).value)}>
                                {holdingEntities.map((entity) => (
                                    <option value={entity.id} key={entity.id}>{entity.name}</option>
                                ))}
                            </select>
                        </label>

                        <label class="field">
                            <span>Units</span>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={form.unitCount}
                                onInput={(event) => onFieldChange('unitCount', (event.target as HTMLInputElement).value)}
                            />
                        </label>

                        <label class="field">
                            <span>Unit price</span>
                            <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={form.unitPrice}
                                onInput={(event) => onFieldChange('unitPrice', (event.target as HTMLInputElement).value)}
                            />
                        </label>

                        <label class="field">
                            <span>Fees</span>
                            <input
                                type="number"
                                min="0"
                                step="any"
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
                            <strong>{totalValue === null ? '-' : formatCurrency(totalValue)}</strong>
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

                    {form.isAddingNewSecurity ? (
                        <div class="new-security-panel">
                            <h3>New security details</h3>
                            <div class="form-grid">
                                <label class="field">
                                    <span>Market</span>
                                    <input
                                        type="text"
                                        value={form.newSecurityMarket}
                                        onInput={(event) => onFieldChange('newSecurityMarket', (event.target as HTMLInputElement).value)}
                                    />
                                </label>
                            </div>
                        </div>
                    ) : null}

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
                        <button type="submit" class="submit-button">Save buy transaction</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
