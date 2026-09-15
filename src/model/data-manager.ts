import {
    HoldingEntity,
    ShareLot,
    ShareLotTransaction,
    ShareSecurity,
    ShareSecurityPriceRecord,
    ShareTransaction,
} from './data-model';
import { AutoIncrementIdGen } from './auto-increment-id-gen';
import { PortfolioGroupBy, PortfolioRow, SellLotAllocation } from '../types';

export class DataManagerTable {
    entityName: string;
    entities: any[];
    primaryKeyField: string | null = null;

    constructor(entityName: string, primaryKeyField: string | null = null) {
        this.entityName = entityName;
        this.entities = [];
        this.primaryKeyField = primaryKeyField;
    }

    public getById(id: string | number): any | undefined {
        if (this.primaryKeyField) {
            return this.entities.find(entity => entity[this.primaryKeyField!] === id);
        }
        return undefined;
    }

    public add(entity: any): void {
        this.entities.push(entity);
    }

    public removeById(id: string | number): boolean {
        if (this.primaryKeyField) {
            const index = this.entities.findIndex(entity => entity[this.primaryKeyField!] === id);
            if (index !== -1) {
                this.entities.splice(index, 1);
                return true;
            }
        }
        return false;
    }

    public updateById(id: string | number, updatedEntity: any): boolean {
        if (this.primaryKeyField) {
            const index = this.entities.findIndex(entity => entity[this.primaryKeyField!] === id);
            if (index !== -1) {
                this.entities[index] = updatedEntity;
                return true;
            }
        }
        return false;
    }

    public getAll(): any[] {
        return this.entities;
    }

    public loadFromJSON(jsonData: string): void {
        this.entities = JSON.parse(jsonData);
    }

    public find(predicate: (entity: any) => boolean): any[] {
        return this.entities.filter(predicate);
    }

    public hydrate(DataManager: DataManager) : void {

    };
}

export class ShareSecurityTable extends DataManagerTable {
    constructor() {
        super('ShareSecurity', 'id');
    }

    public hydrate(DataManager: DataManager): void {
        // Implement hydration logic specific to ShareSecurityTable if needed
    }
}

export class HoldingEntityTable extends DataManagerTable {
    constructor() {
        super('HoldingEntity', 'id');
    }
}

export class ShareLotTable extends DataManagerTable {
    constructor() {
        super('ShareLot', 'id');
    }
}

export class ShareTransactionTable extends DataManagerTable {
    constructor() {
        super('ShareTransaction', 'id');
    }
}

export class ShareLotTransactionTable extends DataManagerTable {
    constructor() {
        super('ShareLotTransaction', 'id');
    }
}

export class ShareSecurityPriceRecordTable extends DataManagerTable {
    constructor() {
        super('ShareSecurityPriceRecord', 'id');
    }
}

export class DataManager {

    dataManagerTables: Map<string, DataManagerTable>;
    public readonly idGenerator: AutoIncrementIdGen;

    constructor() {
        this.dataManagerTables = new Map<string, DataManagerTable>();
        this.idGenerator = new AutoIncrementIdGen();
    }

    public getNextId(): number {
        return this.idGenerator.getId();
    }

    public getTable(entityName: string): DataManagerTable | undefined{
        return this.dataManagerTables.get(entityName);
    }

    public getAll<T = any>(entityName: string): T[] {
        return (this.getTable(entityName)?.getAll() ?? []) as T[];
    }

    public query<T = any>(entityName: string, predicate: (entity: T) => boolean): T[] {
        return this.getAll<T>(entityName).filter(predicate);
    }

    public deleteShareLot(shareLotId: string): boolean {
        const shareLotTable = this.getTable('ShareLot');
        const shareTransactionTable = this.getTable('ShareTransaction');
        const shareLotTransactionTable = this.getTable('ShareLotTransaction');

        if (!shareLotTable || !shareTransactionTable || !shareLotTransactionTable) {
            return false;
        }

        const shareLot = shareLotTable.getById(shareLotId);
        if (!shareLot) {
            return false;
        }

        const linkedLotTransactions = shareLotTransactionTable
            .getAll()
            .filter((link) => link.shareLot === shareLotId);

        const linkedTransactionIds = new Set(
            linkedLotTransactions
                .map((link) => link.shareTransaction)
                .filter((transactionId) => Boolean(transactionId)),
        );

        const remainingShareLotTransactions = shareLotTransactionTable
            .getAll()
            .filter((link) => link.shareLot !== shareLotId);

        shareLotTransactionTable.entities = remainingShareLotTransactions;

        const remainingShareTransactions = shareTransactionTable
            .getAll()
            .filter((transaction) => {
                if (transaction.id === shareLot.buyTransactionId) {
                    return false;
                }

                return !linkedTransactionIds.has(transaction.id);
            });

        shareTransactionTable.entities = remainingShareTransactions;

        const remainingShareLots = shareLotTable
            .getAll()
            .filter((lot) => lot.id !== shareLotId);

        shareLotTable.entities = remainingShareLots;

        return true;
    }

    public deleteSellTransaction(sellTransactionId: string): boolean {
        const shareTransactionTable = this.getTable('ShareTransaction');
        const shareLotTransactionTable = this.getTable('ShareLotTransaction');
        const shareLotTable = this.getTable('ShareLot');

        if (!shareTransactionTable || !shareLotTransactionTable || !shareLotTable) {
            return false;
        }

        const sellTransaction = shareTransactionTable.getById(sellTransactionId);
        if (!sellTransaction || sellTransaction.type !== 'sell') {
            return false;
        }

        const linkedLotTransactions = shareLotTransactionTable
            .getAll()
            .filter((link) => link.shareTransaction === sellTransactionId);

        const affectedLotIds = new Set(linkedLotTransactions.map((link) => link.shareLot));
        const affectedBuyTransactionIds = new Set(
            shareLotTable
                .getAll()
                .filter((lot) => affectedLotIds.has(lot.id))
                .map((lot) => lot.buyTransactionId)
                .filter((transactionId) => Boolean(transactionId)),
        );

        shareLotTable.getAll().forEach((lot: any) => {
            if (affectedLotIds.has(lot.id) || affectedBuyTransactionIds.has(lot.buyTransactionId)) {
                lot.isOpen = true;
            }
        });

        shareLotTransactionTable.entities = shareLotTransactionTable
            .getAll()
            .filter((link) => link.shareTransaction !== sellTransactionId);

        shareTransactionTable.entities = shareTransactionTable
            .getAll()
            .filter((transaction) => transaction.id !== sellTransactionId);

        return true;
    }

    public addDividendTransaction(input: {
        code: string;
        holdingEntity: string;
        dividendPerShare: number;
        numberOfSecurities: number;
        totalFrankedAmount: number;
        totalUnfrankedAmount: number;
        totalFrankingCredit: number;
        originalCurrency?: string;
        transactionDate?: string | number;
        cutOffDate?: string | number;
        documentRef?: string;
        notes?: string;
    }): ShareTransaction | null {
        const shareTransactionTable = this.getTable('ShareTransaction');

        if (!shareTransactionTable) {
            return null;
        }

        const code = input.code.trim();
        if (!code || !input.holdingEntity) {
            return null;
        }

        const parsedDividendPerShare = Number(input.dividendPerShare);
        const parsedNumberOfSecurities = Number(input.numberOfSecurities);
        const parsedTotalFrankedAmount = Number(input.totalFrankedAmount);
        const parsedTotalUnfrankedAmount = Number(input.totalUnfrankedAmount);
        const parsedTotalFrankingCredit = Number(input.totalFrankingCredit);

        if (!Number.isFinite(parsedDividendPerShare) || parsedDividendPerShare < 0) {
            return null;
        }

        if (!Number.isFinite(parsedNumberOfSecurities) || parsedNumberOfSecurities <= 0) {
            return null;
        }

        if (!Number.isFinite(parsedTotalFrankedAmount) || parsedTotalFrankedAmount < 0) {
            return null;
        }

        if (!Number.isFinite(parsedTotalUnfrankedAmount) || parsedTotalUnfrankedAmount < 0) {
            return null;
        }

        if (!Number.isFinite(parsedTotalFrankingCredit) || parsedTotalFrankingCredit < 0) {
            return null;
        }

        const transactionTimestamp = this.resolveTimestamp(input.transactionDate);
        const cutOffTimestamp = this.resolveTimestamp(input.cutOffDate);
        const transactionId = this.getNextId();

        const transaction = new ShareTransaction({
            id: transactionId,
            code,
            type: 'dividend',
            holdingEntity: input.holdingEntity,
            unitCount: parsedNumberOfSecurities,
            unitPrice: parsedDividendPerShare,
            dividendPerShare: parsedDividendPerShare,
            numberOfSecurities: parsedNumberOfSecurities,
            totalFrankedAmount: parsedTotalFrankedAmount,
            totalUnfrankedAmount: parsedTotalUnfrankedAmount,
            totalFrankingCredit: parsedTotalFrankingCredit,
            originalCurrency: input.originalCurrency?.trim() || 'AUD',
            cutOffDate: cutOffTimestamp,
            fees: 0,
            recordTimestamp: transactionTimestamp,
            transactionTimestamp,
            documentRef: input.documentRef?.trim() || `doc-${transactionId}`,
            notes: input.notes ?? '',
        });

        shareTransactionTable.add(transaction);
        return transaction;
    }

    public addEtfTaxStatementTransaction(input: {
        code: string;
        holdingEntity: string;
        unitCostDelta: number;
        originalCurrency?: string;
        transactionDate?: string | number;
        cutOffDate?: string | number;
        documentRef?: string;
        notes?: string;
    }): ShareTransaction | null {
        const shareTransactionTable = this.getTable('ShareTransaction');

        if (!shareTransactionTable) {
            return null;
        }

        const code = input.code.trim();
        if (!code || !input.holdingEntity) {
            return null;
        }

        const parsedUnitCostDelta = Number(input.unitCostDelta);
        if (!Number.isFinite(parsedUnitCostDelta)) {
            return null;
        }

        const transactionTimestamp = this.resolveTimestamp(input.transactionDate);
        const cutOffTimestamp = this.resolveTimestamp(input.cutOffDate);
        const transactionId = this.getNextId();

        const transaction = new ShareTransaction({
            id: transactionId,
            code,
            type: 'etf-tax-statement',
            holdingEntity: input.holdingEntity,
            unitCount: 0,
            unitPrice: 0,
            unitCostDelta: parsedUnitCostDelta,
            originalCurrency: input.originalCurrency?.trim() || 'AUD',
            cutOffDate: cutOffTimestamp,
            fees: 0,
            recordTimestamp: transactionTimestamp,
            transactionTimestamp,
            documentRef: input.documentRef?.trim() || `doc-${transactionId}`,
            notes: input.notes ?? '',
        });

        shareTransactionTable.add(transaction);
        return transaction;
    }

    public getEtfTaxStatementFinalizationPlan(etfTransactionId: string): {
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
    } | null {
        const shareTransactionTable = this.getTable('ShareTransaction');
        const shareLotTable = this.getTable('ShareLot');
        const shareLotTransactionTable = this.getTable('ShareLotTransaction');

        if (!shareTransactionTable || !shareLotTable || !shareLotTransactionTable) {
            return null;
        }

        const etfTransaction = shareTransactionTable.getById(etfTransactionId);
        if (!etfTransaction || etfTransaction.type !== 'etf-tax-statement') {
            return null;
        }

        if (etfTransaction.finalized === true) {
            return null;
        }

        const cutOffTimestamp = typeof etfTransaction.cutOffDate === 'number' && Number.isFinite(etfTransaction.cutOffDate)
            ? etfTransaction.cutOffDate
            : etfTransaction.transactionTimestamp;

        const windowStartTimestamp = new Date(cutOffTimestamp);
        windowStartTimestamp.setFullYear(windowStartTimestamp.getFullYear() - 1);

        const transactionMap = new Map(
            shareTransactionTable
                .getAll()
                .map((transaction: any) => [transaction.id, transaction]),
        );

        const sellTransactionsByLotId = new Map<string, any[]>();

        for (const link of shareLotTransactionTable.getAll()) {
            const linkedTransaction = transactionMap.get(link.shareTransaction);
            if (!linkedTransaction || linkedTransaction.type !== 'sell') {
                continue;
            }

            const lotId = link.shareLot;
            const existing = sellTransactionsByLotId.get(lotId) ?? [];
            existing.push(linkedTransaction);
            sellTransactionsByLotId.set(lotId, existing);
        }

        const affectedLots = shareLotTable
            .getAll()
            .filter((lot: ShareLot) => {
                if (lot.code.toLowerCase() !== etfTransaction.code.toLowerCase() || lot.holdingEntity !== etfTransaction.holdingEntity) {
                    return false;
                }

                const buyTransaction = transactionMap.get(lot.buyTransactionId);
                const buyTimestamp = typeof buyTransaction?.transactionTimestamp === 'number'
                    ? buyTransaction.transactionTimestamp
                    : 0;

                if (buyTimestamp > cutOffTimestamp) {
                    return false;
                }

                const lotSellTransactions = sellTransactionsByLotId.get(lot.id) ?? [];
                const hasSellDuringWindow = lotSellTransactions.some((transaction) => {
                    const sellTimestamp = typeof transaction.transactionTimestamp === 'number'
                        ? transaction.transactionTimestamp
                        : 0;

                    return sellTimestamp >= windowStartTimestamp.getTime() && sellTimestamp <= cutOffTimestamp;
                });

                if (lot.isOpen !== false) {
                    return true;
                }

                return hasSellDuringWindow;
            })
            .map((lot: ShareLot) => {
                const buyTransaction = transactionMap.get(lot.buyTransactionId);
                const buyDate = typeof buyTransaction?.transactionTimestamp === 'number'
                    ? buyTransaction.transactionTimestamp
                    : undefined;
                const lotSellTransactions = sellTransactionsByLotId.get(lot.id) ?? [];
                const closedDate = lot.isOpen === false
                    ? lotSellTransactions
                        .map((transaction) => typeof transaction.transactionTimestamp === 'number' ? transaction.transactionTimestamp : null)
                        .filter((timestamp): timestamp is number => typeof timestamp === 'number')
                        .sort((left, right) => right - left)[0] ?? null
                    : null;

                return {
                    lot,
                    unitCount: Number(lot.unitCount ?? 0),
                    unitCurrentCost: Number(lot.unitCurrentCost ?? 0),
                    buyDate,
                    isClosed: lot.isOpen === false,
                    closedDate,
                };
            });

        const totalUnits = affectedLots.reduce((sum, entry) => sum + entry.unitCount, 0);
        const unitCostDelta = Number(etfTransaction.unitCostDelta ?? 0);

        if (totalUnits <= 0) {
            return null;
        }

        return {
            affectedLots,
            totalUnits,
            unitCostDelta,
            unitCurrentCostAdjustment: unitCostDelta / totalUnits,
        };
    }

    public finalizeEtfTaxStatementTransaction(etfTransactionId: string): {
        plan: {
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
        };
        updatedLots: ShareLot[];
        updatedLotTransactions: ShareLotTransaction[];
    } | null {
        const shareLotTable = this.getTable('ShareLot');
        const shareLotTransactionTable = this.getTable('ShareLotTransaction');

        if (!shareLotTable || !shareLotTransactionTable) {
            return null;
        }

        const plan = this.getEtfTaxStatementFinalizationPlan(etfTransactionId);
        if (!plan) {
            return null;
        }

        const shareTransactionTable = this.getTable('ShareTransaction');
        if (!shareTransactionTable) {
            return null;
        }

        const etfTransaction = shareTransactionTable.getById(etfTransactionId);
        if (!etfTransaction || etfTransaction.type !== 'etf-tax-statement' || etfTransaction.finalized === true) {
            return null;
        }

        const perShareAdjustment = plan.unitCurrentCostAdjustment;

        etfTransaction.finalized = true;
        etfTransaction.unitCount = plan.totalUnits;
        etfTransaction.unitPrice = perShareAdjustment;

        const updatedLots: ShareLot[] = [];
        const updatedLotTransactions: ShareLotTransaction[] = [];

        const existingLinks = new Map(
            shareLotTransactionTable
                .getAll()
                .filter((link) => link.shareTransaction === etfTransactionId)
                .map((link) => [link.shareLot, link]),
        );

        for (const entry of plan.affectedLots) {
            const targetLot = shareLotTable.getById(entry.lot.id) as ShareLot | undefined;
            if (!targetLot) {
                continue;
            }

            const link = existingLinks.get(targetLot.id);
            if (link) {
                link.unitCount = entry.unitCount;
                link.unitCostDelta = perShareAdjustment;
                updatedLotTransactions.push(link);
            } else {
                const newLink = new ShareLotTransaction({
                    id: this.getNextId(),
                    shareTransaction: etfTransactionId,
                    shareLot: targetLot.id,
                    unitCount: entry.unitCount,
                    unitCostDelta: perShareAdjustment,
                });

                shareLotTransactionTable.add(newLink);
                updatedLotTransactions.push(newLink);
            }

            targetLot.unitCurrentCost = Number(targetLot.unitCurrentCost ?? 0) + perShareAdjustment;
            updatedLots.push(targetLot);
        }

        return {
            plan,
            updatedLots,
            updatedLotTransactions,
        };
    }

    public deleteDividendTransaction(dividendTransactionId: string): boolean {
        const shareTransactionTable = this.getTable('ShareTransaction');
        if (!shareTransactionTable) {
            return false;
        }

        const dividendTransaction = shareTransactionTable.getById(dividendTransactionId);

        if (!dividendTransaction || (dividendTransaction.type !== 'dividend' && dividendTransaction.type !== 'etf-tax-statement')) {
            return false;
        }

        shareTransactionTable.entities = shareTransactionTable
            .getAll()
            .filter((transaction) => transaction.id !== dividendTransactionId);

        return true;
    }

    public replaceEntities<T = any>(entityName: string, entities: T[]): void {
        const table = this.getTable(entityName) ?? this.createTable(entityName, 'id');
        table.entities = [...entities];
    }

    public createTable(entityName: string, primaryKeyField: string | null = null): DataManagerTable {
        const table = this.createTypedTable(entityName, primaryKeyField);
        this.dataManagerTables.set(entityName, table);
        return table;
    }

    private createTypedTable(entityName: string, primaryKeyField: string | null = null): DataManagerTable {
        switch (entityName) {
            case 'ShareSecurity':
                return new ShareSecurityTable();
            case 'HoldingEntity':
                return new HoldingEntityTable();
            case 'ShareLot':
                return new ShareLotTable();
            case 'ShareTransaction':
                return new ShareTransactionTable();
            case 'ShareLotTransaction':
                return new ShareLotTransactionTable();
            case 'ShareSecurityPriceRecord':
                return new ShareSecurityPriceRecordTable();
            default:
                return new DataManagerTable(entityName, primaryKeyField);
        }
    }

    public static fromPayload(data: Record<string, any> | null | undefined): DataManager {
        const manager = new DataManager();
        manager.loadFromPayload(data);
        return manager;
    }

    public loadFromPayload(data: Record<string, any> | null | undefined): void {
        this.dataManagerTables.clear();

        const shareSecurityTable = this.createTable('ShareSecurity', 'id');
        const holdingEntityTable = this.createTable('HoldingEntity', 'id');
        const shareLotTable = this.createTable('ShareLot', 'id');
        const shareTransactionTable = this.createTable('ShareTransaction', 'id');
        const shareLotTransactionTable = this.createTable('ShareLotTransaction', 'id');
        const shareSecurityPriceRecordTable = this.createTable('ShareSecurityPriceRecord', 'id');

        for (const item of data?.ShareSecurities ?? []) {
            shareSecurityTable.add(new ShareSecurity(item));
        }

        for (const item of data?.HoldingEntities ?? []) {
            holdingEntityTable.add(new HoldingEntity(item));
        }

        for (const item of data?.ShareLots ?? []) {
            shareLotTable.add(new ShareLot(item));
        }

        for (const item of data?.ShareTransactions ?? []) {
            const shareTransaction = new ShareTransaction(item);

            if (typeof item?.unitCostDelta === 'number') {
                shareTransaction.unitCostDelta = item.unitCostDelta;
            }

            if (typeof item?.unitCountDelta === 'number') {
                shareTransaction.unitCountDelta = item.unitCountDelta;
            }

            shareTransactionTable.add(shareTransaction);
        }

        for (const item of data?.ShareLotTransactions ?? []) {
            const shareLotTransaction = new ShareLotTransaction(item);

            if (typeof item?.unitCostDelta === 'number') {
                shareLotTransaction.unitCostDelta = item.unitCostDelta;
            }

            shareLotTransactionTable.add(shareLotTransaction);
        }

        for (const item of data?.ShareSecurityPriceRecords ?? []) {
            const shareSecurityPriceRecord = new ShareSecurityPriceRecord(item);
            shareSecurityPriceRecord.preserve = Boolean(shareSecurityPriceRecord.preserve);
            shareSecurityPriceRecordTable.add(shareSecurityPriceRecord);
        }

        const highestId = Object.values(data ?? {})
            .flatMap((entries) => Array.isArray(entries) ? entries : [])
            .reduce((highest, entry) => {
                const id = entry?.id;
                const numericId = typeof id === 'number'
                    ? id
                    : typeof id === 'string' && /^\d+$/.test(id.trim())
                        ? Number(id)
                        : NaN;

                return Number.isSafeInteger(numericId) && numericId > highest ? numericId : highest;
            }, 0);

        this.idGenerator.setNextId(highestId + 1);
    }

    public removeTable(entityName: string): boolean {
        return this.dataManagerTables.delete(entityName);
    }

    public getPortfolioRows(groupBy: PortfolioGroupBy = 'security-entity'): PortfolioRow[] {
        const holdingEntities = this.getAll<HoldingEntity>('HoldingEntity');
        const shareLots = this.getAll<ShareLot>('ShareLot').filter((lot) => lot.isOpen !== false);
        const securities = this.getAll<ShareSecurity>('ShareSecurity');

        const entityMap = new Map(holdingEntities.map((entity) => [String(entity.id), entity]));
        const securityMap = new Map(securities.map((security) => [security.code, security]));

        const groupedRows = new Map<string, PortfolioRow>();

        for (const lot of shareLots) {
            const key = groupBy === 'security' ? lot.code : `${lot.holdingEntity}:${lot.code}`;
            const currentRow = groupedRows.get(key) ?? {
                id: key,
                entity: groupBy === 'security' ? 'All entities' : entityMap.get(String(lot.holdingEntity))?.name ?? lot.holdingEntity,
                code: lot.code,
                unitCount: 0,
                unitCostAverage: 0,
                unitOriginalCostAverage: 0,
                totalCost: 0,
                totalOriginalCost: 0,
                currentPrice: 0,
                currentValue: 0,
                profitPosition: 0,
                profitPercent: 0,
                originalCostProfitPosition: 0,
            };

            currentRow.unitCount += Number(lot.unitCount);
            currentRow.totalCost += Number(lot.unitCount) * this.getLotCurrentCost(lot);
            currentRow.totalOriginalCost += Number(lot.unitCount) * Number(lot.unitOriginalCost ?? 0);
            groupedRows.set(key, currentRow);
        }

        return Array.from(groupedRows.values())
            .map((row) => {
                const security = securityMap.get(row.code);
                const latestPrice = security?.lastPrice ?? 0;

                row.unitCostAverage = row.unitCount > 0 ? row.totalCost / row.unitCount : 0;
                row.unitOriginalCostAverage = row.unitCount > 0 ? row.totalOriginalCost / row.unitCount : 0;
                row.currentPrice = latestPrice;
                row.currentValue = row.unitCount * latestPrice;
                row.profitPosition = row.currentValue - row.totalCost;
                row.profitPercent = row.unitCostAverage > 0 ? ((latestPrice - row.unitCostAverage) / row.unitCostAverage) * 100 : 0;
                row.originalCostProfitPosition = row.currentValue - row.totalOriginalCost;
                return row;
            })
            .sort((a, b) => a.entity.localeCompare(b.entity) || a.code.localeCompare(b.code));
    }

    public getSellLotAllocations(code: string, holdingEntity: string): SellLotAllocation[] {
        const lots = this.getAll<ShareLot>('ShareLot').filter((lot) => {
            return lot.code === code && lot.holdingEntity === holdingEntity && lot.isOpen !== false;
        });

        const shareTransactions = this.getAll<ShareTransaction>('ShareTransaction');
        const transactionMap = new Map(shareTransactions.map((transaction) => [transaction.id, transaction]));

        return lots.map((lot) => {
            const linkedBuyTransaction = transactionMap.get(lot.buyTransactionId);
            const buyTransactionDate = linkedBuyTransaction
                ? new Date(linkedBuyTransaction.transactionTimestamp).toISOString().slice(0, 10)
                : '';

            const buyTransactionPrice = typeof linkedBuyTransaction?.unitPrice === 'number'
                ? linkedBuyTransaction.unitPrice
                : undefined;

            return {
                shareLotId: lot.id,
                availableUnits: Number(lot.unitCount),
                unitCount: '0',
                label: `${buyTransactionDate || 'Buy date unavailable'}${typeof buyTransactionPrice === 'number' ? ` @ $${buyTransactionPrice.toFixed(2)}` : ''} · ${Number(lot.unitCount)} units available`,
                buyTransactionDate,
                buyTransactionPrice,
            };
        });
    }

    public getAllocatedUnits(lotAllocations: SellLotAllocation[]): number {
        return lotAllocations.reduce((sum, allocation) => {
            const parsedUnitCount = Number(allocation.unitCount);
            return sum + (Number.isFinite(parsedUnitCount) ? parsedUnitCount : 0);
        }, 0);
    }

    public addBuyTransaction(input: {
        code: string;
        holdingEntity: string;
        unitCount: number;
        unitPrice: number;
        fees?: number;
        notes?: string;
        transactionDate?: string | number;
        documentRef?: string;
        newSecurity?: {
            code: string;
            market: string;
        } | null;
    }): {
        transaction: any;
        shareLot: any;
        shareLotTransaction: any;
        securityPriceRecord: any;
    } | null {
        const shareTransactionTable = this.getTable('ShareTransaction');
        const shareLotTable = this.getTable('ShareLot');
        const shareLotTransactionTable = this.getTable('ShareLotTransaction');
        const shareSecurityTable = this.getTable('ShareSecurity');
        const shareSecurityPriceRecordTable = this.getTable('ShareSecurityPriceRecord');

        if (!shareTransactionTable || !shareLotTable || !shareLotTransactionTable || !shareSecurityTable || !shareSecurityPriceRecordTable) {
            return null;
        }

        const code = (input.newSecurity?.code ?? input.code).trim();
        if (!code) {
            return null;
        }

        const market = input.newSecurity?.market?.trim() || 'ASX';
        const transactionTimestamp = this.resolveTimestamp(input.transactionDate);

        let matchingSecurity = shareSecurityTable.getAll().find((entry: any) => entry.code.toLowerCase() === code.toLowerCase());

        if (input.newSecurity) {
            const existingCode = shareSecurityTable.getAll().find((entry: any) => entry.code.toLowerCase() === code.toLowerCase());
            if (existingCode) {
                return null;
            }

            matchingSecurity = {
                id: this.getNextId(),
                code,
                market,
                lastPrice: input.unitPrice,
                lastPriceTimeStamp: transactionTimestamp,
            };
            shareSecurityTable.add(matchingSecurity);
        }

        if (!matchingSecurity) {
            return null;
        }

        const transactionId = this.getNextId();
        const shareLotId = this.getNextId();
        const shareLotTransactionId = this.getNextId();

        const transaction = {
            id: transactionId,
            code,
            type: 'buy',
            holdingEntity: input.holdingEntity,
            unitCount: input.unitCount,
            unitPrice: input.unitPrice,
            fees: input.fees ?? 0,
            recordTimestamp: transactionTimestamp,
            transactionTimestamp,
            documentRef: input.documentRef?.trim() || `doc-${transactionId}`,
            notes: input.notes ?? '',
        };

        const shareLot = {
            id: shareLotId,
            code,
            holdingEntity: input.holdingEntity,
            unitCount: input.unitCount,
            unitOriginalCost: input.unitPrice,
            unitCurrentCost: input.unitPrice,
            isOpen: true,
            buyTransactionId: transactionId,
        };

        const shareLotTransaction = {
            id: shareLotTransactionId,
            shareTransaction: transactionId,
            shareLot: shareLotId,
            unitCount: input.unitCount,
        };

        const securityPriceRecord = {
            id: this.getNextId(),
            code,
            price: input.unitPrice,
            timeStamp: transactionTimestamp,
            preserve: false,
        };

        shareTransactionTable.add(transaction);
        shareLotTable.add(shareLot);
        shareLotTransactionTable.add(shareLotTransaction);
        shareSecurityPriceRecordTable.add(securityPriceRecord);

        this.updateSecurityPriceReference(matchingSecurity, input.unitPrice, transactionTimestamp);

        return {
            transaction,
            shareLot,
            shareLotTransaction,
            securityPriceRecord,
        };
    }

    public addSellTransaction(input: {
        code: string;
        holdingEntity: string;
        unitPrice: number;
        fees?: number;
        notes?: string;
        transactionDate?: string | number;
        documentRef?: string;
        lotAllocations: Array<{
            shareLotId: string;
            unitCount: number;
        }>;
    }): {
        transaction: any;
        shareLotTransactions: any[];
        updatedLots: any[];
        createdLots: any[];
        securityPriceRecord: any;
    } | null {
        const shareTransactionTable = this.getTable('ShareTransaction');
        const shareLotTable = this.getTable('ShareLot');
        const shareLotTransactionTable = this.getTable('ShareLotTransaction');
        const shareSecurityTable = this.getTable('ShareSecurity');
        const shareSecurityPriceRecordTable = this.getTable('ShareSecurityPriceRecord');

        if (!shareTransactionTable || !shareLotTable || !shareLotTransactionTable || !shareSecurityTable || !shareSecurityPriceRecordTable) {
            return null;
        }

        const code = input.code.trim();
        if (!code || !input.holdingEntity || input.lotAllocations.length === 0) {
            return null;
        }

        const transactionTimestamp = this.resolveTimestamp(input.transactionDate);
        const transactionId = this.getNextId();

        const validLotAllocations = input.lotAllocations
            .filter((allocation) => allocation && allocation.shareLotId && Number.isFinite(allocation.unitCount) && allocation.unitCount > 0)
            .map((allocation) => ({
                shareLotId: allocation.shareLotId,
                unitCount: Number(allocation.unitCount),
            }));

        if (validLotAllocations.length === 0) {
            return null;
        }

        const allLots = shareLotTable.getAll() as any[];
        const selectedLots = validLotAllocations.map((allocation) => {
            return allLots.find((lot) => lot.id === allocation.shareLotId && lot.code.toLowerCase() === code.toLowerCase() && lot.holdingEntity === input.holdingEntity && lot.isOpen !== false);
        }).filter((lot): lot is any => Boolean(lot));

        if (selectedLots.length !== validLotAllocations.length) {
            return null;
        }

        const totalUnits = validLotAllocations.reduce((sum, allocation) => sum + allocation.unitCount, 0);

        for (const [index, allocation] of validLotAllocations.entries()) {
            const lot = selectedLots[index];
            if (allocation.unitCount > Number(lot.unitCount)) {
                return null;
            }
        }

        const transaction = {
            id: transactionId,
            code,
            type: 'sell',
            holdingEntity: input.holdingEntity,
            unitCount: totalUnits,
            unitPrice: input.unitPrice,
            fees: input.fees ?? 0,
            recordTimestamp: transactionTimestamp,
            transactionTimestamp,
            documentRef: input.documentRef?.trim() || `doc-${transactionId}`,
            notes: input.notes ?? '',
        };

        const shareLotTransactions: any[] = [];
        const updatedLots: any[] = [];
        const createdLots: any[] = [];

        for (const allocation of validLotAllocations) {
            const lot = allLots.find((entry) => entry.id === allocation.shareLotId) as any;
            const soldUnits = allocation.unitCount;

            if (soldUnits === Number(lot.unitCount)) {
                lot.isOpen = false;
                updatedLots.push(lot);
            } else {
                const remainingUnits = Number(lot.unitCount) - soldUnits;
                lot.isOpen = false;
                lot.unitCount = soldUnits;
                updatedLots.push(lot);

                const remainderLot = {
                    id: this.getNextId(),
                    code: lot.code,
                    holdingEntity: lot.holdingEntity,
                    unitCount: remainingUnits,
                    unitOriginalCost: lot.unitOriginalCost,
                    unitCurrentCost: lot.unitCurrentCost,
                    isOpen: true,
                    buyTransactionId: lot.buyTransactionId,
                };
                shareLotTable.add(remainderLot);
                createdLots.push(remainderLot);
            }

            const shareLotTransaction = {
                id: this.getNextId(),
                shareTransaction: transactionId,
                shareLot: lot.id,
                unitCount: soldUnits,
            };
            shareLotTransactionTable.add(shareLotTransaction);
            shareLotTransactions.push(shareLotTransaction);
        }

        const matchingSecurity = shareSecurityTable.getAll().find((entry: any) => entry.code.toLowerCase() === code.toLowerCase());
        if (matchingSecurity) {
            this.updateSecurityPriceReference(matchingSecurity, input.unitPrice, transactionTimestamp);
        }

        const securityPriceRecord = {
            id: this.getNextId(),
            code,
            price: input.unitPrice,
            timeStamp: transactionTimestamp,
            preserve: false,
        };
        shareSecurityPriceRecordTable.add(securityPriceRecord);

        shareTransactionTable.add(transaction);

        return {
            transaction,
            shareLotTransactions,
            updatedLots,
            createdLots,
            securityPriceRecord,
        };
    }

    public addBulkSecurityPriceRecords(input: {
        timestamp?: string | number;
        preserve?: boolean;
        priceRecords: Array<{
            code: string;
            price: number;
        }>;
    }): {
        priceRecords: any[];
        updatedSecurities: any[];
    } | null {
        const shareSecurityTable = this.getTable('ShareSecurity');
        const shareSecurityPriceRecordTable = this.getTable('ShareSecurityPriceRecord');

        if (!shareSecurityTable || !shareSecurityPriceRecordTable) {
            return null;
        }

        const timestamp = this.resolveTimestamp(input.timestamp);
        const preserve = Boolean(input.preserve);
        const securities = shareSecurityTable.getAll() as any[];
        const securityMap = new Map(securities.map((security) => [security.code.toLowerCase(), security]));

        const normalizedEntries: Array<{ code: string; price: number; security: any }> = [];

        for (const [index, entry] of input.priceRecords.entries()) {
            const code = entry?.code?.trim();
            const price = Number(entry?.price);

            if (!code || !Number.isFinite(price) || price <= 0) {
                return null;
            }

            const matchingSecurity = securityMap.get(code.toLowerCase());
            if (!matchingSecurity) {
                return null;
            }

            normalizedEntries.push({
                code,
                price,
                security: matchingSecurity,
            });
        }

        const priceRecords: any[] = [];

        for (const [index, entry] of normalizedEntries.entries()) {
            const priceRecord = {
                id: this.getNextId(),
                code: entry.code,
                price: entry.price,
                timeStamp: timestamp,
                preserve,
            };

            shareSecurityPriceRecordTable.add(priceRecord);
            this.updateSecurityPriceReference(entry.security, entry.price, timestamp);
            priceRecords.push(priceRecord);
        }

        return {
            priceRecords,
            updatedSecurities: securities,
        };
    }

    public deleteSecurityPriceRecords(input: {
        code?: string;
        fromDate: string;
        toDate: string;
        includePreserved?: boolean;
    }): number {
        const table = this.getTable('ShareSecurityPriceRecord');
        if (!table) {
            return 0;
        }

        const fromTimestamp = new Date(`${input.fromDate}T00:00:00.000`).getTime();
        const toTimestamp = new Date(`${input.toDate}T23:59:59.999`).getTime();
        if (!Number.isFinite(fromTimestamp) || !Number.isFinite(toTimestamp) || fromTimestamp > toTimestamp) {
            return 0;
        }

        const normalizedCode = input.code?.toLowerCase();
        const records = table.getAll() as ShareSecurityPriceRecord[];
        const remainingRecords = records.filter((record) => {
            const matchesCode = !normalizedCode || record.code.toLowerCase() === normalizedCode;
            const matchesDate = record.timeStamp >= fromTimestamp && record.timeStamp <= toTimestamp;
            const canDelete = input.includePreserved === true || record.preserve !== true;
            return !(matchesCode && matchesDate && canDelete);
        });

        const deletedCount = records.length - remainingRecords.length;
        table.entities = remainingRecords;
        return deletedCount;
    }

    private getLotCurrentCost(lot: ShareLot): number {
        return Number(lot.unitCurrentCost ?? lot.unitOriginalCost ?? 0);
    }

    private updateSecurityPriceReference(security: any, price: number, timestamp: number): void {
        if (!security) {
            return;
        }

        security.lastPrice = price;
        security.lastPriceTimeStamp = timestamp;
    }

    private resolveTimestamp(transactionDate?: string | number): number {
        if (typeof transactionDate === 'number' && Number.isFinite(transactionDate)) {
            return transactionDate;
        }

        if (typeof transactionDate === 'string' && transactionDate.trim()) {
            const parsed = new Date(transactionDate).getTime();
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }

        return Date.now();
    }

}