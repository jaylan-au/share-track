import { ComponentChildren } from 'preact';
import { BulkPriceUpdateFormState } from '../types';

interface BulkPriceModalProps {
    form: BulkPriceUpdateFormState;
    isOpen: boolean;
    onClose: () => void;
    onFieldChange: (field: keyof BulkPriceUpdateFormState, value: string | boolean) => void;
    onSubmit: (event: Event) => void;
}

export function BulkPriceModal({
    form,
    isOpen,
    onClose,
    onFieldChange,
    onSubmit,
}: BulkPriceModalProps): ComponentChildren {
    if (!isOpen) {
        return null;
    }

    return (
        <div class="modal-backdrop" onClick={onClose}>
            <div class="modal-dialog" onClick={(event) => event.stopPropagation()}>
                <div class="modal-header">
                    <h2>Bulk update security prices</h2>
                    <button class="icon-button" type="button" onClick={onClose}>×</button>
                </div>

                <form class="transaction-form" onSubmit={onSubmit}>
                    <div class="form-grid">
                        <label class="field">
                            <span>Timestamp</span>
                            <input
                                type="datetime-local"
                                value={form.timestamp}
                                onInput={(event) => onFieldChange('timestamp', (event.target as HTMLInputElement).value)}
                            />
                        </label>
                    </div>

                    <label class="field full-width">
                        <span>Security prices</span>
                        <textarea
                            rows={12}
                            value={form.priceLines}
                            placeholder="ABC 10.50\nXYZ 25.75"
                            onInput={(event) => onFieldChange('priceLines', (event.target as HTMLTextAreaElement).value)}
                        />
                    </label>

                    <div class="checkbox-field">
                        <input
                            type="checkbox"
                            checked={form.preservePriceRecord}
                            onInput={(event) => onFieldChange('preservePriceRecord', (event.target as HTMLInputElement).checked)}
                        />
                        <label>Preserve price record</label>
                    </div>

                    <p class="data-upload-note">
                        Enter one security code and price per line in the format: [code] [price]
                    </p>

                    <div class="form-actions">
                        <button type="button" class="secondary-button" onClick={onClose}>Cancel</button>
                        <button type="submit" class="submit-button">Save price updates</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
