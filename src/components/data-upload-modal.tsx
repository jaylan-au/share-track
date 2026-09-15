import { ComponentChildren } from 'preact';

interface DataUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (file: File | null) => void;
}

export function DataUploadModal({ isOpen, onClose, onUpload }: DataUploadModalProps): ComponentChildren {
    if (!isOpen) {
        return null;
    }

    return (
        <div class="modal-backdrop" onClick={onClose}>
            <div class="modal-dialog" onClick={(event) => event.stopPropagation()}>
                <div class="modal-header">
                    <h2>Upload data file</h2>
                    <button class="icon-button" type="button" onClick={onClose}>×</button>
                </div>

                <div class="data-upload-panel">
                    <div
                        class="data-dropzone"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                            event.preventDefault();
                            const file = event.dataTransfer?.files?.[0] ?? null;
                            onUpload(file);
                        }}
                    >
                        <p>Drag and drop a JSON file here</p>
                        <span>or click below to browse</span>
                    </div>

                    <label class="field full-width">
                        <span>Select file</span>
                        <input
                            type="file"
                            accept=".json,application/json"
                            onInput={(event) => {
                                const file = (event.target as HTMLInputElement).files?.[0] ?? null;
                                onUpload(file);
                                (event.target as HTMLInputElement).value = '';
                            }}
                        />
                    </label>

                    <p class="data-upload-note">
                        Uploading a data file will replace the current in-memory dataset.
                    </p>
                </div>
            </div>
        </div>
    );
}
