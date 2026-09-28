import { ComponentChildren } from 'preact';

interface BulkTransactionModalProps {
    transactionLines: string;
    isOpen: boolean;
    onClose: () => void;
    onChange: (value: string) => void;
    onSubmit: (event: Event) => void;
}

export function BulkTransactionModal({
    transactionLines,
    isOpen,
    onClose,
    onChange,
    onSubmit,
}: BulkTransactionModalProps): ComponentChildren {
    if (!isOpen) {
        return null;
    }

    return (
        <div class="modal-backdrop" onClick={onClose}>
            <div class="modal-dialog" onClick={(event) => event.stopPropagation()}>
                <div class="modal-header">
                    <h2>Bulk load transactions</h2>
                    <button class="icon-button" type="button" onClick={onClose}>×</button>
                </div>

                <form class="transaction-form" onSubmit={onSubmit}>
                    <label class="field full-width">
                        <span>Transactions</span>
                        <textarea
                            rows={14}
                            value={transactionLines}
                            placeholder={'buy,ASX:ABC,Personal Broker,100,12.50,2026-01-15\nsell\tASX:ABC\tPersonal Broker\t25\t14.00\t2026-02-20'}
                            onInput={(event) => onChange((event.target as HTMLTextAreaElement).value)}
                        />
                    </label>

                    <p class="data-upload-note">
                        One transaction per line: type, share code, holding entity name, units, price, date, optional fees, optional document reference. Separate values with spaces, commas, or tabs. Sell transactions use available lots in FIFO order.
                    </p>

                    <div class="form-actions">
                        <button type="button" class="secondary-button" onClick={onClose}>Cancel</button>
                        <button type="submit" class="submit-button">Load transactions</button>
                    </div>
                </form>
            </div>
        </div>
    );
}