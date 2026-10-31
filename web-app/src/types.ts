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
export type AppPage = 'library' | 'portfolio' | 'admin' | 'share-lots' | 'dividends' | 'activity-report' | 'price-records';
export type FlashMessageType = 'success' | 'error';

export interface PortfolioSummary {
    id: string;
    fileName: string;
    latestVersionId: string;
    updatedAt: string;
    versionCount: number;
}

export interface TrashedPortfolioSummary extends PortfolioSummary {
    trashedAt: string;
}

export type LibraryStatus = 'loading' | 'ready' | 'signin-required' | 'error';

export type AuthStatus = 'checking' | 'signed-in' | 'signed-out';

export interface ActivePortfolio {
    id: string;
    fileName: string;
}

export interface PortfolioNameDialogState {
    isCopy: boolean;
    suggestedName: string;
}

export interface AppState {
    isLoading: boolean;
    portfolioRows: PortfolioRow[];
    error: string | null;
    flashMessage: string | null;
    flashMessageType: FlashMessageType;
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
    authStatus: AuthStatus;
    showSplash: boolean;
    libraryStatus: LibraryStatus;
    libraryError: string | null;
    portfolios: PortfolioSummary[];
    trashedPortfolios: TrashedPortfolioSummary[];
    activePortfolio: ActivePortfolio | null;
    nameDialog: PortfolioNameDialogState | null;
}
