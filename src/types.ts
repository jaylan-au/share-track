import { HoldingEntity, ShareSecurity } from './model/data-model';

export interface PortfolioRow {
    id: string;
    entity: string;
    code: string;
    unitCount: number;
    unitCostAverage: number;
    unitOriginalCostAverage: number;
    totalCost: number;
    totalOriginalCost: number;
    currentPrice: number;
    currentValue: number;
    profitPosition: number;
    profitPercent: number;
    originalCostProfitPosition: number;
}

export interface BuyTransactionFormState {
    code: string;
    holdingEntity: string;
    unitCount: string;
    unitPrice: string;
    fees: string;
    transactionDate: string;
    documentRef: string;
    notes: string;
    isAddingNewSecurity: boolean;
    newSecurityCode: string;
    newSecurityMarket: string;
}

export interface SellLotAllocation {
    shareLotId: string;
    availableUnits: number;
    unitCount: string;
    label: string;
    buyTransactionDate?: string;
    buyTransactionPrice?: number;
}

export interface SellTransactionFormState {
    code: string;
    holdingEntity: string;
    unitCount: string;
    unitPrice: string;
    fees: string;
    transactionDate: string;
    documentRef: string;
    notes: string;
    lotAllocations: SellLotAllocation[];
}

export interface BulkPriceUpdateFormState {
    timestamp: string;
    priceLines: string;
    preservePriceRecord: boolean;
}

export interface BulkTransactionFormState {
    transactionLines: string;
}

export interface DividendTransactionInput {
    code: string;
    holdingEntity: string;
    dividendPerShare: number;
    numberOfSecurities: number;
    totalFrankedAmount: number;
    totalUnfrankedAmount: number;
    totalFrankingCredit: number;
    originalCurrency: string;
    transactionDate?: string | number;
    cutOffDate?: string | number;
    documentRef?: string;
    notes?: string;
}

export interface EtfTaxStatementTransactionInput {
    code: string;
    holdingEntity: string;
    unitCostDelta: number;
    originalCurrency: string;
    transactionDate?: string | number;
    cutOffDate?: string | number;
    documentRef?: string;
    notes?: string;
}

export type PortfolioGroupBy = 'security' | 'security-entity';
export type AppPage = 'portfolio' | 'admin' | 'share-lots' | 'dividends' | 'activity-report' | 'price-records';

export interface AppState {
    isLoading: boolean;
    portfolioRows: PortfolioRow[];
    error: string | null;
    hasUnsavedChanges: boolean;
    securities: ShareSecurity[];
    holdingEntities: HoldingEntity[];
    form: BuyTransactionFormState;
    sellForm: SellTransactionFormState;
    bulkPriceForm: BulkPriceUpdateFormState;
    bulkTransactionForm: BulkTransactionFormState;
    isBuyModalOpen: boolean;
    isSellModalOpen: boolean;
    isDataModalOpen: boolean;
    isBulkPriceModalOpen: boolean;
    isBulkTransactionModalOpen: boolean;
    portfolioGroupBy: PortfolioGroupBy;
    currentPage: AppPage;
    selectedSecurityCode: string | null;
}
