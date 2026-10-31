import { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

interface PortfolioNameModalProps {
    title: string;
    initialName: string;
    onSubmit: (name: string) => void;
    onClose: () => void;
}

export function PortfolioNameModal({ title, initialName, onSubmit, onClose }: PortfolioNameModalProps): ComponentChildren {
    const [name, setName] = useState(initialName);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleSubmit = (event: Event) => {
        event.preventDefault();
        const trimmed = name.trim().replace(/\.json$/i, '').trim();
        if (!trimmed) {
            setError('Please enter a name for the portfolio.');
            return;
        }
        onSubmit(trimmed);
    };

    return (
        <div class="modal-backdrop" onClick={onClose}>
            <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="portfolio-name-title" onClick={(event) => event.stopPropagation()}>
                <div class="modal-header">
                    <h2 id="portfolio-name-title">{title}</h2>
                    <button class="icon-button" type="button" aria-label="Close" onClick={onClose}>×</button>
                </div>

                <form class="transaction-form" onSubmit={handleSubmit}>
                    <label class="field full-width">
                        <span>Portfolio name</span>
                        <div class="name-input-row">
                            <input
                                ref={inputRef}
                                type="text"
                                value={name}
                                aria-invalid={error ? 'true' : undefined}
                                onInput={(event) => {
                                    setName((event.target as HTMLInputElement).value);
                                    setError(null);
                                }}
                            />
                            <span class="name-input-suffix">.json</span>
                        </div>
                    </label>

                    {error ? <p class="name-input-error" role="alert">{error}</p> : null}

                    <div class="form-actions">
                        <button type="button" class="secondary-button" onClick={onClose}>Cancel</button>
                        <button type="submit" class="submit-button">Save</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
