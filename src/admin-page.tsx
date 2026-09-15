import { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { EntityId, HoldingEntity, ShareSecurity } from './model/data-model';
import { PriceRecordDeleteForm } from './price-records-page';

interface AdminPageProps {
    securities: ShareSecurity[];
    holdingEntities: HoldingEntity[];
    hasUnsavedChanges: boolean;
    onSaveSecurity: (updatedSecurity: ShareSecurity) => void;
    onSaveHoldingEntity: (updatedHoldingEntity: HoldingEntity) => void;
    onRemoveSecurity: (id: EntityId) => void;
    onRemoveHoldingEntity: (id: EntityId) => void;
    onChange: () => void;
    getNextId: () => number;
    onViewSecurityPrices: (code: string) => void;
    onDeleteAllPriceRecords: (fromDate: string, toDate: string, includePreserved: boolean) => number;
    onBack: () => void;
}

export function AdminPage({
    securities,
    holdingEntities,
    hasUnsavedChanges,
    onSaveSecurity,
    onSaveHoldingEntity,
    onRemoveSecurity,
    onRemoveHoldingEntity,
    onChange,
    getNextId,
    onViewSecurityPrices,
    onDeleteAllPriceRecords,
    onBack,
}: AdminPageProps): ComponentChildren {
    const [localSecurities, setLocalSecurities] = useState<ShareSecurity[]>(() => securities.map((security) => ({ ...security })));
    const [localHoldingEntities, setLocalHoldingEntities] = useState<HoldingEntity[]>(() => holdingEntities.map((entity) => ({ ...entity })));

    const updateSecurity = (id: EntityId, field: keyof ShareSecurity, value: string): void => {
        onChange();
        setLocalSecurities((current) => current.map((security) => {
            if (security.id !== id) {
                return security;
            }

            return {
                ...security,
                [field]: field === 'lastPrice' ? Number(value) : value,
            };
        }));
    };

    const updateHoldingEntity = (id: EntityId, field: keyof HoldingEntity, value: string): void => {
        onChange();
        setLocalHoldingEntities((current) => current.map((entity) => {
            if (entity.id !== id) {
                return entity;
            }

            return {
                ...entity,
                [field]: value,
            };
        }));
    };

    const addSecurity = (): void => {
        onChange();
        setLocalSecurities((current) => [
            ...current,
            {
                id: getNextId(),
                code: '',
                market: 'ASX',
                lastPrice: 0,
                lastPriceTimeStamp: Date.now(),
            },
        ]);
    };

    const addHoldingEntity = (): void => {
        onChange();
        setLocalHoldingEntities((current) => [
            ...current,
            {
                id: getNextId(),
                name: '',
                market: 'ASX',
            },
        ]);
    };

    const removeSecurity = (id: EntityId): void => {
        setLocalSecurities((current) => current.filter((security) => security.id !== id));
        onRemoveSecurity(id);
    };

    const removeHoldingEntity = (id: EntityId): void => {
        setLocalHoldingEntities((current) => current.filter((entity) => entity.id !== id));
        onRemoveHoldingEntity(id);
    };

    const saveSecurity = (security: ShareSecurity): void => {
        onSaveSecurity({
            ...security,
            lastPrice: Number(security.lastPrice ?? 0),
        });
    };

    const saveHoldingEntity = (entity: HoldingEntity): void => {
        onSaveHoldingEntity({
            ...entity,
        });
    };

    return (
        <div class="app-shell">
            <header class="app-header">
                <div>
                    <p class="eyebrow">ShareTrack</p>
                    <h1>Admin</h1>
                    {hasUnsavedChanges ? <span class="unsaved-changes">Unsaved changes</span> : null}
                </div>
                <div class="header-actions">
                    <button class="secondary-button" type="button" onClick={onBack}>Back to portfolio</button>
                </div>
            </header>

            <main class="content-panel">
                <div class="transaction-form-panel">
                    <h2>Registered securities</h2>
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Code</th>
                                <th>Market</th>
                                <th>Last price</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {localSecurities.map((security) => (
                                <tr key={security.id}>
                                    <td>{security.id}</td>
                                    <td>
                                        <input
                                            value={security.code}
                                            onInput={(event) => updateSecurity(security.id, 'code', (event.target as HTMLInputElement).value)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            value={security.market}
                                            onInput={(event) => updateSecurity(security.id, 'market', (event.target as HTMLInputElement).value)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={security.lastPrice ?? 0}
                                            onInput={(event) => updateSecurity(security.id, 'lastPrice', (event.target as HTMLInputElement).value)}
                                        />
                                    </td>
                                    <td class="table-actions">
                                        <button class="primary-button" type="button" onClick={() => saveSecurity(security)}>Save row</button>
                                        <button class="secondary-button" type="button" onClick={() => onViewSecurityPrices(security.code)}>Price records</button>
                                        <button class="secondary-button" type="button" onClick={() => removeSecurity(security.id)}>Remove</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div class="form-actions">
                        <button class="secondary-button" type="button" onClick={addSecurity}>Add security</button>
                    </div>
                </div>

                <div class="transaction-form-panel">
                    <h2>All security price records</h2>
                    <PriceRecordDeleteForm scopeLabel="all securities" onDelete={onDeleteAllPriceRecords} />
                </div>

                <div class="transaction-form-panel">
                    <h2>Holding entities</h2>
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Market</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {localHoldingEntities.map((entity) => (
                                <tr key={entity.id}>
                                    <td>{entity.id}</td>
                                    <td>
                                        <input
                                            value={entity.name}
                                            onInput={(event) => updateHoldingEntity(entity.id, 'name', (event.target as HTMLInputElement).value)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            value={entity.market}
                                            onInput={(event) => updateHoldingEntity(entity.id, 'market', (event.target as HTMLInputElement).value)}
                                        />
                                    </td>
                                    <td class="table-actions">
                                        <button class="primary-button" type="button" onClick={() => saveHoldingEntity(entity)}>Save row</button>
                                        <button class="secondary-button" type="button" onClick={() => removeHoldingEntity(entity.id)}>Remove</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div class="form-actions">
                        <button class="secondary-button" type="button" onClick={addHoldingEntity}>Add holding entity</button>
                    </div>
                </div>
            </main>
        </div>
    );
}
