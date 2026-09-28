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
    const [dirtySecurityIds, setDirtySecurityIds] = useState<Set<string>>(() => new Set());
    const [dirtyHoldingEntityIds, setDirtyHoldingEntityIds] = useState<Set<string>>(() => new Set());
    const [newSecurityIds, setNewSecurityIds] = useState<Set<string>>(() => new Set());

    const getRowKey = (id: EntityId): string => String(id);

    const updateSecurity = (id: EntityId, field: keyof ShareSecurity, value: string): void => {
        onChange();
        setDirtySecurityIds((current) => new Set(current).add(getRowKey(id)));
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
        setDirtyHoldingEntityIds((current) => new Set(current).add(getRowKey(id)));
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
        const id = getNextId();
        setDirtySecurityIds((current) => new Set(current).add(getRowKey(id)));
        setNewSecurityIds((current) => new Set(current).add(getRowKey(id)));
        setLocalSecurities((current) => [
            ...current,
            {
                id,
                code: '',
                market: 'ASX',
                lastPrice: 0,
                lastPriceTimeStamp: Date.now(),
            },
        ]);
    };

    const addHoldingEntity = (): void => {
        onChange();
        const id = getNextId();
        setDirtyHoldingEntityIds((current) => new Set(current).add(getRowKey(id)));
        setLocalHoldingEntities((current) => [
            ...current,
            {
                id,
                name: '',
                market: 'ASX',
            },
        ]);
    };

    const removeSecurity = (id: EntityId): void => {
        setLocalSecurities((current) => current.filter((security) => security.id !== id));
        setDirtySecurityIds((current) => {
            const next = new Set(current);
            next.delete(getRowKey(id));
            return next;
        });
        setNewSecurityIds((current) => {
            const next = new Set(current);
            next.delete(getRowKey(id));
            return next;
        });
        onRemoveSecurity(id);
    };

    const removeHoldingEntity = (id: EntityId): void => {
        setLocalHoldingEntities((current) => current.filter((entity) => entity.id !== id));
        setDirtyHoldingEntityIds((current) => {
            const next = new Set(current);
            next.delete(getRowKey(id));
            return next;
        });
        onRemoveHoldingEntity(id);
    };

    const saveSecurity = (security: ShareSecurity): void => {
        onSaveSecurity({
            ...security,
            lastPrice: Number(security.lastPrice ?? 0),
        });
        setDirtySecurityIds((current) => {
            const next = new Set(current);
            next.delete(getRowKey(security.id));
            return next;
        });
        setNewSecurityIds((current) => {
            const next = new Set(current);
            next.delete(getRowKey(security.id));
            return next;
        });
    };

    const saveHoldingEntity = (entity: HoldingEntity): void => {
        onSaveHoldingEntity({
            ...entity,
        });
        setDirtyHoldingEntityIds((current) => {
            const next = new Set(current);
            next.delete(getRowKey(entity.id));
            return next;
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
                    <div class="table-scroll-container">
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
                                    <td data-label="ID">{security.id}</td>
                                    <td data-label="Code">
                                        <input
                                            value={security.code}
                                            onInput={(event) => updateSecurity(security.id, 'code', (event.target as HTMLInputElement).value)}
                                        />
                                    </td>
                                    <td data-label="Market">
                                        <input
                                            value={security.market}
                                            onInput={(event) => updateSecurity(security.id, 'market', (event.target as HTMLInputElement).value)}
                                        />
                                    </td>
                                    <td data-label="Last price">
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={security.lastPrice ?? 0}
                                            onInput={(event) => updateSecurity(security.id, 'lastPrice', (event.target as HTMLInputElement).value)}
                                        />
                                    </td>
                                    <td data-label="Actions" class="table-actions">
                                        {dirtySecurityIds.has(getRowKey(security.id)) ? (
                                            <button class="primary-button" type="button" onClick={() => saveSecurity(security)}>Save row</button>
                                        ) : null}
                                        {!newSecurityIds.has(getRowKey(security.id)) ? (
                                            <button class="secondary-button" type="button" onClick={() => onViewSecurityPrices(security.code)}>Price records</button>
                                        ) : null}
                                        <button class="secondary-button" type="button" onClick={() => removeSecurity(security.id)}>Remove</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
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
                    <div class="table-scroll-container">
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
                                    <td data-label="ID">{entity.id}</td>
                                    <td data-label="Name">
                                        <input
                                            value={entity.name}
                                            onInput={(event) => updateHoldingEntity(entity.id, 'name', (event.target as HTMLInputElement).value)}
                                        />
                                    </td>
                                    <td data-label="Market">
                                        <input
                                            value={entity.market}
                                            onInput={(event) => updateHoldingEntity(entity.id, 'market', (event.target as HTMLInputElement).value)}
                                        />
                                    </td>
                                    <td data-label="Actions" class="table-actions">
                                        {dirtyHoldingEntityIds.has(getRowKey(entity.id)) ? (
                                            <button class="primary-button" type="button" onClick={() => saveHoldingEntity(entity)}>Save row</button>
                                        ) : null}
                                        <button class="secondary-button" type="button" onClick={() => removeHoldingEntity(entity.id)}>Remove</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                    <div class="form-actions">
                        <button class="secondary-button" type="button" onClick={addHoldingEntity}>Add holding entity</button>
                    </div>
                </div>
            </main>
        </div>
    );
}
