import { Component, render } from 'preact';
import './style.css';
import { BuyTransactionModal } from './components/buy-transaction-modal';
import { BulkPriceModal } from './components/bulk-price-modal';
import { BulkTransactionModal } from './components/bulk-transaction-modal';
import { DataUploadModal } from './components/data-upload-modal';
import { SellTransactionModal } from './components/sell-transaction-modal';
import { DataManager } from './model/data-manager';
import { EntityId, HoldingEntity, ShareSecurity } from './model/data-model';
import { AdminPage } from './admin-page';
import { PortFolioTable } from './portfolio-table';
import { DividendsPage } from './dividends-page';
import { ShareLotsPage } from './share-lots-page';
import { ActivityReportPage } from './activity-report-page';
import { PriceRecordsPage } from './price-records-page';
import {
    AppState,
    BulkPriceUpdateFormState,
    BulkTransactionFormState,
    BuyTransactionFormState,
    DividendTransactionInput,
    EtfTaxStatementTransactionInput,
    PortfolioGroupBy,
    PortfolioRow,
    SellLotAllocation,
    SellTransactionFormState,
} from './types';

type ModalKey = 'isBuyModalOpen' | 'isSellModalOpen' | 'isDataModalOpen' | 'isBulkPriceModalOpen' | 'isBulkTransactionModalOpen';

class App extends Component<{}, AppState> {
    private dataManager: DataManager | null = null;

    state: AppState = {
        isLoading: true,
        portfolioRows: [],
        error: null,
        hasUnsavedChanges: false,
        securities: [],
        holdingEntities: [],
        form: this.createEmptyBuyFormState(),
        sellForm: this.createEmptySellFormState(),
        bulkPriceForm: this.createEmptyBulkPriceFormState(),
        bulkTransactionForm: this.createEmptyBulkTransactionFormState(),
        isBuyModalOpen: false,
        isSellModalOpen: false,
        isDataModalOpen: false,
        isBulkPriceModalOpen: false,
        isBulkTransactionModalOpen: false,
        portfolioGroupBy: 'security-entity',
        currentPage: 'portfolio',
        selectedSecurityCode: null,
    };

    componentDidMount(): void {
        this.loadPortfolioData();
    }

    private createEmptyBuyFormState(): BuyTransactionFormState {
        return {
            code: '',
            holdingEntity: '',
            unitCount: '',
            unitPrice: '',
            fees: '0',
            transactionDate: this.getCurrentDateString(),
            documentRef: '',
            notes: '',
            isAddingNewSecurity: false,
            newSecurityCode: '',
            newSecurityMarket: 'ASX',
        };
    }

    private createEmptySellFormState(): SellTransactionFormState {
        return {
            code: '',
            holdingEntity: '',
            unitCount: '',
            unitPrice: '',
            fees: '0',
            transactionDate: this.getCurrentDateString(),
            documentRef: '',
            notes: '',
            lotAllocations: [],
        };
    }

    private createEmptyBulkPriceFormState(): BulkPriceUpdateFormState {
        return {
            timestamp: this.getCurrentDateTimeString(),
            priceLines: '',
            preservePriceRecord: false,
        };
    }

    private createEmptyBulkTransactionFormState(): BulkTransactionFormState {
        return {
            transactionLines: '',
        };
    }

    private getCurrentDateString(): string {
        return new Date().toISOString().slice(0, 10);
    }

    private getCurrentDateTimeString(): string {
        return new Date().toISOString().slice(0, 16);
    }

    private setModalVisibility(modal: ModalKey, isOpen: boolean): void {
        this.setState((prevState) => ({
            ...prevState,
            error: null,
            [modal]: isOpen,
        }));
    }

    private getUpdatedSecurities(): ShareSecurity[] {
        return this.dataManager?.getTable('ShareSecurity')?.getAll() as ShareSecurity[] ?? [];
    }

    private refreshPortfolioAfterMutation(partialState: Partial<AppState> = {}): void {
        if (!this.dataManager) {
            return;
        }

        this.setState({
            error: null,
            hasUnsavedChanges: true,
            portfolioRows: this.dataManager.getPortfolioRows(this.state.portfolioGroupBy),
            securities: this.getUpdatedSecurities(),
            ...partialState,
        });
    }

    private applyLoadedData(manager: DataManager): void {
        const securities = manager.getAll<ShareSecurity>('ShareSecurity');
        const holdingEntities = manager.getAll<HoldingEntity>('HoldingEntity');
        const defaultForm = this.getDefaultFormState(securities, holdingEntities);
        const defaultSellForm = this.getDefaultSellFormState(securities, holdingEntities, manager);
        const portfolioRows = manager.getPortfolioRows(this.state.portfolioGroupBy);

        this.dataManager = manager;

        this.setState({
            isLoading: false,
            portfolioRows,
            error: null,
            hasUnsavedChanges: false,
            securities,
            holdingEntities,
            form: defaultForm,
            sellForm: defaultSellForm,
            selectedSecurityCode: null,
        });
    }

    private loadPortfolioData(): void {
        this.applyLoadedData(DataManager.fromPayload({}));
    }

    private getDefaultFormState(securities: ShareSecurity[], holdingEntities: HoldingEntity[]): BuyTransactionFormState {
        return {
            ...this.createEmptyBuyFormState(),
            code: securities[0]?.code ?? '',
            holdingEntity: holdingEntities[0]?.id ?? '',
            unitPrice: securities[0]?.lastPrice ? String(securities[0].lastPrice) : '',
        };
    }

    private getDefaultSellFormState(securities: ShareSecurity[], holdingEntities: HoldingEntity[], manager: DataManager | null = this.dataManager): SellTransactionFormState {
        const code = securities[0]?.code ?? '';
        const holdingEntity = holdingEntities[0]?.id ?? '';

        const defaultForm = {
            ...this.createEmptySellFormState(),
            code,
            holdingEntity,
            unitPrice: securities[0]?.lastPrice ? String(securities[0].lastPrice) : '',
        };

        return this.syncSellLotAllocations(defaultForm, manager);
    }

    private syncSellLotAllocations(
        sellForm: SellTransactionFormState,
        manager: DataManager | null = this.dataManager,
        previousLotAllocations: SellLotAllocation[] = sellForm.lotAllocations,
    ): SellTransactionFormState {
        const freshLotAllocations = manager
            ? manager.getSellLotAllocations(sellForm.code, sellForm.holdingEntity)
            : [];

        const previousAllocationsById = new Map(previousLotAllocations.map((allocation) => [allocation.shareLotId, allocation]));

        return {
            ...sellForm,
            lotAllocations: freshLotAllocations.map((allocation) => {
                const previousAllocation = previousAllocationsById.get(allocation.shareLotId);

                return {
                    ...allocation,
                    unitCount: previousAllocation?.unitCount ?? allocation.unitCount,
                };
            }),
        };
    }

    private updatePortfolioGroupBy = (groupBy: PortfolioGroupBy): void => {
        if (!this.dataManager) {
            return;
        }

        this.setState({
            portfolioGroupBy: groupBy,
            portfolioRows: this.dataManager.getPortfolioRows(groupBy),
        });
    };

    private updateFormField = (field: keyof BuyTransactionFormState, value: string): void => {
        this.setState((prevState) => ({
            ...prevState,
            form: {
                ...prevState.form,
                [field]: value,
            },
        }));
    };

    private updateSellFormField = (field: keyof SellTransactionFormState, value: string): void => {
        this.setState((prevState) => {
            const nextSellForm = {
                ...prevState.sellForm,
                [field]: value,
            } as SellTransactionFormState;

            if (field === 'code' || field === 'holdingEntity') {
                return {
                    ...prevState,
                    sellForm: this.syncSellLotAllocations(nextSellForm),
                };
            }

            return {
                ...prevState,
                sellForm: nextSellForm,
            };
        });
    };

    private updateBulkPriceFormField = (field: keyof BulkPriceUpdateFormState, value: string | boolean): void => {
        this.setState((prevState) => ({
            ...prevState,
            bulkPriceForm: {
                ...prevState.bulkPriceForm,
                [field]: value,
            },
        }));
    };

    private toggleBuySecurityMode = (isAddingNewSecurity: boolean): void => {
        this.setState((prevState) => ({
            ...prevState,
            form: {
                ...prevState.form,
                isAddingNewSecurity,
            },
        }));
    };

    private updateSellLotAllocation = (shareLotId: string, unitCount: string): void => {
        this.setState((prevState) => ({
            ...prevState,
            sellForm: {
                ...prevState.sellForm,
                lotAllocations: prevState.sellForm.lotAllocations.map((allocation) => {
                    if (allocation.shareLotId === shareLotId) {
                        return {
                            ...allocation,
                            unitCount,
                        };
                    }
                    return allocation;
                }),
            },
        }));
    };

    private assignAllUnitsToLot = (shareLotId: string): void => {
        this.setState((prevState) => ({
            ...prevState,
            sellForm: {
                ...prevState.sellForm,
                lotAllocations: prevState.sellForm.lotAllocations.map((allocation) => {
                    if (allocation.shareLotId === shareLotId) {
                        return {
                            ...allocation,
                            unitCount: String(allocation.availableUnits),
                        };
                    }
                    return allocation;
                }),
            },
        }));
    };

    private handleSubmit = (event: Event): void => {
        event.preventDefault();

        if (!this.dataManager) {
            this.setState({
                error: 'Portfolio data is not loaded yet.',
            });
            return;
        }

        const { code, holdingEntity, unitCount, unitPrice, fees, notes, transactionDate, documentRef, isAddingNewSecurity, newSecurityCode, newSecurityMarket } = this.state.form;
        const parsedUnitCount = Number(unitCount);
        const parsedUnitPrice = Number(unitPrice);
        const parsedFees = Number(fees || 0);

        const hasNewSecurity = isAddingNewSecurity && Boolean(newSecurityCode && newSecurityCode.trim());
        const securityCode = hasNewSecurity ? newSecurityCode.trim() : code;

        if (!holdingEntity || !Number.isFinite(parsedUnitCount) || parsedUnitCount <= 0 || !Number.isFinite(parsedUnitPrice) || parsedUnitPrice <= 0 || !transactionDate) {
            this.setState({
                error: 'Please provide a valid holding entity, transaction date, units, and unit price.',
            });
            return;
        }

        if (!securityCode) {
            this.setState({
                error: 'Please provide a security code or create a new security.',
            });
            return;
        }

        const result = this.dataManager.addBuyTransaction({
            code: securityCode,
            holdingEntity,
            unitCount: parsedUnitCount,
            unitPrice: parsedUnitPrice,
            fees: parsedFees,
            notes,
            transactionDate,
            documentRef: documentRef.trim() || undefined,
            newSecurity: hasNewSecurity ? {
                code: securityCode,
                market: newSecurityMarket || 'ASX',
            } : null,
        });

        if (!result) {
            this.setState({
                error: 'Unable to add buy transaction.',
            });
            return;
        }

        const updatedSecurities = this.getUpdatedSecurities();

        this.refreshPortfolioAfterMutation({
            form: this.getDefaultFormState(updatedSecurities, this.state.holdingEntities),
            sellForm: this.getDefaultSellFormState(updatedSecurities, this.state.holdingEntities, this.dataManager),
            isBuyModalOpen: false,
        });
    };

    private refreshAdminRegistryState = (): void => {
        if (!this.dataManager) {
            return;
        }

        const nextSecurities = this.dataManager.getAll<ShareSecurity>('ShareSecurity');
        const nextHoldingEntities = this.dataManager.getAll<HoldingEntity>('HoldingEntity');

        this.setState({
            securities: nextSecurities,
            holdingEntities: nextHoldingEntities,
            portfolioRows: this.dataManager.getPortfolioRows(this.state.portfolioGroupBy),
            form: this.getDefaultFormState(nextSecurities, nextHoldingEntities),
            sellForm: this.getDefaultSellFormState(nextSecurities, nextHoldingEntities, this.dataManager),
            error: null,
            hasUnsavedChanges: true,
        });
    };

    private handleSaveSecurity = (updatedSecurity: ShareSecurity): void => {
        if (!this.dataManager) {
            return;
        }

        const table = this.dataManager.getTable('ShareSecurity');
        if (!table) {
            return;
        }

        if (table.getById(updatedSecurity.id)) {
            table.updateById(updatedSecurity.id, updatedSecurity);
        } else {
            table.add(updatedSecurity);
        }

        this.refreshAdminRegistryState();
    };

    private handleSaveHoldingEntity = (updatedHoldingEntity: HoldingEntity): void => {
        if (!this.dataManager) {
            return;
        }

        const table = this.dataManager.getTable('HoldingEntity');
        if (!table) {
            return;
        }

        if (table.getById(updatedHoldingEntity.id)) {
            table.updateById(updatedHoldingEntity.id, updatedHoldingEntity);
        } else {
            table.add(updatedHoldingEntity);
        }

        this.refreshAdminRegistryState();
    };

    private handleRemoveSecurity = (id: EntityId): void => {
        if (!this.dataManager) {
            return;
        }

        this.dataManager.getTable('ShareSecurity')?.removeById(id);
        this.refreshAdminRegistryState();
    };

    private handleRemoveHoldingEntity = (id: EntityId): void => {
        if (!this.dataManager) {
            return;
        }

        this.dataManager.getTable('HoldingEntity')?.removeById(id);
        this.refreshAdminRegistryState();
    };

    private handleViewSecurityPrices = (code: string): void => {
        this.setState({
            currentPage: 'price-records',
            selectedSecurityCode: code,
        });
    };

    private handleDeletePriceRecords = (code?: string) => (fromDate: string, toDate: string, includePreserved: boolean): number => {
        if (!this.dataManager) {
            return 0;
        }

        const deletedCount = this.dataManager.deleteSecurityPriceRecords({
            code,
            fromDate,
            toDate,
            includePreserved,
        });

        if (deletedCount > 0) {
            this.refreshPortfolioAfterMutation();
        }

        return deletedCount;
    };

    private handleDeleteShareLot = (shareLotId: string): void => {
        if (!this.dataManager) {
            return;
        }

        this.dataManager.deleteShareLot(shareLotId);
        this.refreshPortfolioAfterMutation();
    };

    private handleDeleteSellTransaction = (sellTransactionId: string): void => {
        if (!this.dataManager) {
            return;
        }

        this.dataManager.deleteSellTransaction(sellTransactionId);
        this.refreshPortfolioAfterMutation();
    };

    private handleAddDividend = (input: DividendTransactionInput): void => {
        if (!this.dataManager) {
            return;
        }

        const dividend = this.dataManager.addDividendTransaction(input);

        if (!dividend) {
            this.setState({
                error: 'Unable to add dividend transaction.',
            });
            return;
        }

        this.refreshPortfolioAfterMutation({
            currentPage: 'dividends',
        });
    };

    private handleAddEtfTaxStatement = (input: EtfTaxStatementTransactionInput): void => {
        if (!this.dataManager) {
            return;
        }

        const dividend = this.dataManager.addEtfTaxStatementTransaction(input);

        if (!dividend) {
            this.setState({
                error: 'Unable to add ETF Tax Statement transaction.',
            });
            return;
        }

        this.refreshPortfolioAfterMutation({
            currentPage: 'dividends',
        });
    };

    private handlePreviewEtfTaxStatement = (etfTransactionId: string): any | null => {
        if (!this.dataManager) {
            return null;
        }

        return this.dataManager.getEtfTaxStatementFinalizationPlan(etfTransactionId);
    };

    private handleFinalizeEtfTaxStatement = (etfTransactionId: string): void => {
        if (!this.dataManager) {
            return;
        }

        const result = this.dataManager.finalizeEtfTaxStatementTransaction(etfTransactionId);

        if (!result) {
            this.setState({
                error: 'Unable to finalise ETF Tax Statement.',
            });
            return;
        }

        this.refreshPortfolioAfterMutation({
            currentPage: 'dividends',
        });
    };

    private handleDeleteDividend = (dividendTransactionId: string): void => {
        if (!this.dataManager) {
            return;
        }

        this.dataManager.deleteDividendTransaction(dividendTransactionId);
        this.refreshPortfolioAfterMutation({
            currentPage: 'dividends',
        });
    };

    private handleDataUpload = (file: File | null): void => {
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const fileContents = typeof reader.result === 'string' ? reader.result : '';
                const parsedData = JSON.parse(fileContents) as any;
                const manager = DataManager.fromPayload(parsedData);
                this.applyLoadedData(manager);
                this.setState({ isDataModalOpen: false, error: null });
            } catch (error) {
                this.setState({
                    error: error instanceof Error ? error.message : 'Unable to parse the uploaded data file.',
                });
            }
        };
        reader.onerror = () => {
            this.setState({
                error: 'Unable to read the uploaded data file.',
            });
        };
        reader.readAsText(file);
    };

    private downloadCurrentData = (): void => {
        if (!this.dataManager) {
            return;
        }

        const payload = {
            ShareSecurities: (this.dataManager.getTable('ShareSecurity')?.getAll() ?? []).map((item: any) => ({ ...item })),
            HoldingEntities: (this.dataManager.getTable('HoldingEntity')?.getAll() ?? []).map((item: any) => ({ ...item })),
            ShareLots: (this.dataManager.getTable('ShareLot')?.getAll() ?? []).map((item: any) => ({ ...item })),
            ShareTransactions: (this.dataManager.getTable('ShareTransaction')?.getAll() ?? []).map((item: any) => {
                const transaction = { ...item };

                if (typeof item.unitCostDelta === 'number') {
                    transaction.unitCostDelta = item.unitCostDelta;
                }

                if (typeof item.unitCountDelta === 'number') {
                    transaction.unitCountDelta = item.unitCountDelta;
                }

                return transaction;
            }),
            ShareLotTransactions: (this.dataManager.getTable('ShareLotTransaction')?.getAll() ?? []).map((item: any) => {
                const lotTransaction = { ...item };

                if (typeof item.unitCostDelta === 'number') {
                    lotTransaction.unitCostDelta = item.unitCostDelta;
                }

                return lotTransaction;
            }),
            ShareSecurityPriceRecords: (this.dataManager.getTable('ShareSecurityPriceRecord')?.getAll() ?? []).map((item: any) => ({ ...item })),
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'share-track-data.json';
        anchor.click();
        URL.revokeObjectURL(url);
        this.setState({ hasUnsavedChanges: false });
    };

    private handleBulkPriceSubmit = (event: Event): void => {
        event.preventDefault();

        if (!this.dataManager) {
            this.setState({
                error: 'Portfolio data is not loaded yet.',
            });
            return;
        }

        const { timestamp, priceLines, preservePriceRecord } = this.state.bulkPriceForm;
        const trimmedPriceLines = priceLines.trim();

        if (!timestamp || !trimmedPriceLines) {
            this.setState({
                error: 'Please provide a timestamp and at least one price record.',
            });
            return;
        }

        const priceEntries = trimmedPriceLines
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        if (priceEntries.length === 0) {
            this.setState({
                error: 'Please provide at least one price record.',
            });
            return;
        }

        try {
            const parsedEntries = priceEntries.map((line, index) => {
                const parts = line.split(/[\s,\t]+/).filter(Boolean);
                if (parts.length !== 2) {
                    throw new Error(`Line ${index + 1} must be in the format: [code] [price]`);
                }

                const price = Number(parts[1]);
                if (!parts[0] || !Number.isFinite(price) || price <= 0) {
                    throw new Error(`Line ${index + 1} must contain a valid security code and price.`);
                }

                return {
                    code: parts[0],
                    price,
                };
            });

            const validEntries = parsedEntries.filter((entry) => {
                const securityExists = this.dataManager?.getTable('ShareSecurity')?.getAll().some((security) => {
                    return (security as ShareSecurity).code.toLowerCase() === entry.code.toLowerCase();
                });

                return Boolean(securityExists);
            });

            const result = this.dataManager.addBulkSecurityPriceRecords({
                timestamp,
                preserve: preservePriceRecord,
                priceRecords: validEntries,
            });

            if (!result) {
                this.setState({
                    error: 'Unable to add security price records. Please verify the security codes exist.',
                });
                return;
            }

            const updatedSecurities = this.getUpdatedSecurities();

            this.refreshPortfolioAfterMutation({
                securities: updatedSecurities,
                bulkPriceForm: this.createEmptyBulkPriceFormState(),
                isBulkPriceModalOpen: false,
            });
        } catch (error) {
            this.setState({
                error: error instanceof Error ? error.message : 'Unable to add security price records.',
            });
        }
    };

    private handleBulkTransactionSubmit = (event: Event): void => {
        event.preventDefault();

        if (!this.dataManager) {
            this.setState({ error: 'Portfolio data is not loaded yet.' });
            return;
        }

        const lines = this.state.bulkTransactionForm.transactionLines
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        if (lines.length === 0) {
            this.setState({ error: 'Please provide at least one transaction.' });
            return;
        }

        try {
            let processedCount = 0;
            const securities = this.dataManager.getAll<ShareSecurity>('ShareSecurity');
            const holdingEntities = this.dataManager.getAll<HoldingEntity>('HoldingEntity');

            lines.forEach((line, index) => {
                let parts: string[];
                if (line.includes(',')) {
                    parts = line.split(',').map((part) => part.trim());
                } else if (line.includes('\t')) {
                    parts = line.split('\t').map((part) => part.trim());
                } else {
                    const whitespaceParts = line.split(/\s+/).filter(Boolean);
                    const matchingEntity = holdingEntities
                        .slice()
                        .sort((first, second) => second.name.length - first.name.length)
                        .find((entry) => {
                            const entityWordCount = entry.name.trim().split(/\s+/).length;
                            const entityText = whitespaceParts.slice(2, 2 + entityWordCount).join(' ');
                            return entityText.toLowerCase() === entry.name.toLowerCase();
                        });

                    if (matchingEntity) {
                        const entityWordCount = matchingEntity.name.trim().split(/\s+/).length;
                        parts = [
                            whitespaceParts[0],
                            whitespaceParts[1],
                            matchingEntity.name,
                            ...whitespaceParts.slice(2 + entityWordCount),
                        ];
                    } else {
                        parts = whitespaceParts;
                    }
                }
                if (index === 0 && parts[0]?.toLowerCase() === 'type') {
                    return;
                }

                if (parts.length < 6 || parts.length > 8) {
                    throw new Error(`Line ${index + 1} must contain 6 to 8 values.`);
                }

                const [type, code, holdingEntity, unitsText, priceText, transactionDate, feesText, documentRef] = parts;
                const normalizedType = type.toLowerCase();
                const security = securities.find((entry) => entry.code.toLowerCase() === code.toLowerCase());
                const entity = holdingEntities.find((entry) => entry.name.toLowerCase() === holdingEntity.toLowerCase());
                const unitCount = Number(unitsText);
                const unitPrice = Number(priceText);
                const fees = feesText === undefined ? 0 : Number(feesText);

                if (normalizedType !== 'buy' && normalizedType !== 'sell') {
                    throw new Error(`Line ${index + 1} must start with buy or sell.`);
                }

                if (!security) {
                    throw new Error(`Line ${index + 1} references an unknown security code: ${code}.`);
                }

                if (!entity) {
                    throw new Error(`Line ${index + 1} references an unknown holding entity name: ${holdingEntity}.`);
                }

                if (!code || !holdingEntity || !transactionDate || !Number.isFinite(unitCount) || unitCount <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0 || !Number.isFinite(fees) || fees < 0) {
                    throw new Error(`Line ${index + 1} contains invalid transaction values.`);
                }

                if (normalizedType === 'buy') {
                    const result = this.dataManager?.addBuyTransaction({
                        code: security.code,
                        holdingEntity: String(entity.id),
                        unitCount,
                        unitPrice,
                        fees,
                        transactionDate,
                        documentRef,
                        notes: '',
                        newSecurity: null,
                    });

                    if (!result) {
                        throw new Error(`Line ${index + 1} could not be added. Check that the security exists.`);
                    }
                } else {
                    const availableLots = this.dataManager?.getSellLotAllocations(security.code, String(entity.id)) ?? [];
                    let remainingUnits = unitCount;
                    const lotAllocations = availableLots.map((lot) => {
                        const allocatedUnits = Math.min(remainingUnits, lot.availableUnits);
                        remainingUnits -= allocatedUnits;
                        return {
                            shareLotId: lot.shareLotId,
                            unitCount: allocatedUnits,
                        };
                    }).filter((allocation) => allocation.unitCount > 0);

                    if (remainingUnits > 0) {
                        throw new Error(`Line ${index + 1} cannot sell ${unitCount} units; insufficient open lots.`);
                    }

                    const result = this.dataManager?.addSellTransaction({
                        code: security.code,
                        holdingEntity: String(entity.id),
                        unitPrice,
                        fees,
                        transactionDate,
                        documentRef,
                        notes: '',
                        lotAllocations,
                    });

                    if (!result) {
                        throw new Error(`Line ${index + 1} could not be added.`);
                    }
                }

                processedCount += 1;
            });

            if (processedCount === 0) {
                throw new Error('Please provide at least one transaction row.');
            }

            const updatedSecurities = this.getUpdatedSecurities();
            this.refreshPortfolioAfterMutation({
                securities: updatedSecurities,
                form: this.getDefaultFormState(updatedSecurities, this.state.holdingEntities),
                sellForm: this.getDefaultSellFormState(updatedSecurities, this.state.holdingEntities, this.dataManager),
                bulkTransactionForm: this.createEmptyBulkTransactionFormState(),
                isBulkTransactionModalOpen: false,
            });
        } catch (error) {
            this.setState({
                error: error instanceof Error ? error.message : 'Unable to load transactions.',
            });
        }
    };

    private handleSellSubmit = (event: Event): void => {
        event.preventDefault();

        if (!this.dataManager) {
            this.setState({
                error: 'Portfolio data is not loaded yet.',
            });
            return;
        }

        const { code, holdingEntity, unitCount, unitPrice, fees, notes, transactionDate, documentRef, lotAllocations } = this.state.sellForm;
        const parsedUnitPrice = Number(unitPrice);
        const parsedFees = Number(fees || 0);
        const parsedUnitCount = Number(unitCount);

        if (!code || !holdingEntity || !Number.isFinite(parsedUnitCount) || parsedUnitCount <= 0 || !Number.isFinite(parsedUnitPrice) || parsedUnitPrice <= 0 || !transactionDate) {
            this.setState({
                error: 'Please provide a valid security, holding entity, units to sell, transaction date, and sell price.',
            });
            return;
        }

        const allocations = lotAllocations
            .map((allocation) => ({
                shareLotId: allocation.shareLotId,
                unitCount: Number(allocation.unitCount),
            }))
            .filter((allocation) => Number.isFinite(allocation.unitCount) && allocation.unitCount > 0);

        if (allocations.length === 0) {
            this.setState({
                error: 'Please select at least one open share lot and enter a valid unit count to sell.',
            });
            return;
        }

        const totalAllocatedUnits = allocations.reduce((sum, allocation) => sum + allocation.unitCount, 0);

        if (totalAllocatedUnits !== parsedUnitCount) {
            this.setState({
                error: `The selected allocations total ${totalAllocatedUnits} units, which does not match the ${parsedUnitCount} units being sold.`,
            });
            return;
        }

        for (const allocation of allocations) {
            const match = lotAllocations.find((entry) => entry.shareLotId === allocation.shareLotId);
            if (!match) {
                this.setState({
                    error: 'Unable to validate share lot allocation.',
                });
                return;
            }

            if (allocation.unitCount > match.availableUnits) {
                this.setState({
                    error: `Cannot sell more than ${match.availableUnits} units from ${match.shareLotId}.`,
                });
                return;
            }
        }

        const result = this.dataManager.addSellTransaction({
            code,
            holdingEntity,
            unitPrice: parsedUnitPrice,
            fees: parsedFees,
            notes,
            transactionDate,
            documentRef: documentRef.trim() || undefined,
            lotAllocations: allocations,
        });

        if (!result) {
            this.setState({
                error: 'Unable to add sell transaction.',
            });
            return;
        }

        const updatedSecurities = this.getUpdatedSecurities();

        this.refreshPortfolioAfterMutation({
            sellForm: this.getDefaultSellFormState(updatedSecurities, this.state.holdingEntities, this.dataManager),
            isSellModalOpen: false,
        });
    };

    render() {
        const { isLoading, portfolioRows, error, hasUnsavedChanges, securities, holdingEntities, form, sellForm, bulkPriceForm, bulkTransactionForm, isBuyModalOpen, isSellModalOpen, isDataModalOpen, isBulkPriceModalOpen, isBulkTransactionModalOpen, portfolioGroupBy, currentPage, selectedSecurityCode } = this.state;
        const activeSellForm = this.syncSellLotAllocations(sellForm, this.dataManager, sellForm.lotAllocations);

        if (currentPage === 'admin') {
            return (
                <AdminPage
                    securities={securities}
                    holdingEntities={holdingEntities}
                    hasUnsavedChanges={hasUnsavedChanges}
                    onSaveSecurity={this.handleSaveSecurity}
                    onSaveHoldingEntity={this.handleSaveHoldingEntity}
                    onRemoveSecurity={this.handleRemoveSecurity}
                    onRemoveHoldingEntity={this.handleRemoveHoldingEntity}
                    onChange={() => this.setState({ hasUnsavedChanges: true })}
                    getNextId={() => this.dataManager?.getNextId() ?? 1}
                    onViewSecurityPrices={this.handleViewSecurityPrices}
                    onDeleteAllPriceRecords={this.handleDeletePriceRecords()}
                    onBack={() => this.setState({ currentPage: 'portfolio' })}
                />
            );
        }

        if (currentPage === 'share-lots') {
            return (
                <ShareLotsPage
                    shareLots={this.dataManager?.getAll('ShareLot') ?? []}
                    shareTransactions={this.dataManager?.getAll('ShareTransaction') ?? []}
                    shareLotTransactions={this.dataManager?.getAll('ShareLotTransaction') ?? []}
                    onDeleteShareLot={this.handleDeleteShareLot}
                    onDeleteSellTransaction={this.handleDeleteSellTransaction}
                    onBack={() => this.setState({ currentPage: 'portfolio' })}
                    hasUnsavedChanges={hasUnsavedChanges}
                />
            );
        }

        if (currentPage === 'dividends') {
            return (
                <DividendsPage
                    dividends={this.dataManager?.getAll('ShareTransaction') ?? []}
                    shareLots={this.dataManager?.getAll('ShareLot') ?? []}
                    shareLotTransactions={this.dataManager?.getAll('ShareLotTransaction') ?? []}
                    securities={securities}
                    holdingEntities={holdingEntities}
                    onAddDividend={this.handleAddDividend}
                    onAddEtfTaxStatement={this.handleAddEtfTaxStatement}
                    onPreviewEtfTaxStatement={this.handlePreviewEtfTaxStatement}
                    onFinalizeEtfTaxStatement={this.handleFinalizeEtfTaxStatement}
                    onDeleteDividend={this.handleDeleteDividend}
                    hasUnsavedChanges={hasUnsavedChanges}
                    onBack={() => this.setState({ currentPage: 'portfolio' })}
                />
            );
        }
        if (currentPage === 'activity-report') {
            return (
                <ActivityReportPage
                    transactions={this.dataManager?.getAll('ShareTransaction') ?? []}
                    lots={this.dataManager?.getAll('ShareLot') ?? []}
                    lotLinks={this.dataManager?.getAll('ShareLotTransaction') ?? []}
                    holdingEntities={holdingEntities}
                    securities={securities}
                    hasUnsavedChanges={hasUnsavedChanges}
                    onBack={() => this.setState({ currentPage: 'portfolio' })}
                />
            );
        }
        if (currentPage === 'price-records' && selectedSecurityCode) {
            const securityRecords = (this.dataManager?.getAll('ShareSecurityPriceRecord') ?? [])
                .filter((record: any) => record.code.toLowerCase() === selectedSecurityCode.toLowerCase())
                .sort((left: any, right: any) => right.timeStamp - left.timeStamp);

            return (
                <PriceRecordsPage
                    code={selectedSecurityCode}
                    records={securityRecords}
                    scopeLabel={`${selectedSecurityCode} security`}
                    hasUnsavedChanges={hasUnsavedChanges}
                    onDelete={this.handleDeletePriceRecords(selectedSecurityCode)}
                    onBack={() => this.setState({ currentPage: 'admin' })}
                />
            );
        }
        const totalAllocatedUnits = this.dataManager?.getAllocatedUnits(activeSellForm.lotAllocations) ?? 0;
        const sellUnitCount = Number(activeSellForm.unitCount);
        const isAllocationValid = Number.isFinite(sellUnitCount) && sellUnitCount > 0 && totalAllocatedUnits === sellUnitCount;

        return (
            <div class="app-shell">
                <header class="app-header">
                    <div>
                        <p class="eyebrow">ShareTrack</p>
                        <h1>Portfolio</h1>
                        {hasUnsavedChanges ? <span class="unsaved-changes">Unsaved changes</span> : null}
                    </div>
                    <div class="header-actions">
                        <label class="grouping-select">
                            <span>Group by</span>
                            <select
                                value={portfolioGroupBy}
                                onInput={(event) => this.updatePortfolioGroupBy((event.target as HTMLSelectElement).value as PortfolioGroupBy)}
                            >
                                <option value="security">Security code only</option>
                                <option value="security-entity">Security code and entity</option>
                            </select>
                        </label>

                        <details class="header-dropdown">
                            <summary class="secondary-button">Actions</summary>
                            <div class="dropdown-menu">
                                <button
                                    class="secondary-button dropdown-button"
                                    onClick={() => this.setState({ currentPage: 'admin' })}
                                    type="button"
                                >
                                    Admin
                                </button>
                                <button
                                    class="secondary-button dropdown-button"
                                    onClick={() => this.setState({ currentPage: 'share-lots' })}
                                    type="button"
                                >
                                    Share lots
                                </button>
                                <button
                                    class="secondary-button dropdown-button"
                                    onClick={() => this.setState({ currentPage: 'dividends' })}
                                    type="button"
                                >
                                    Dividends
                                </button>
                                <button
                                    class="secondary-button dropdown-button"
                                    onClick={() => this.setState({ currentPage: 'activity-report' })}
                                    type="button"
                                >
                                    Activity report
                                </button>
                                <button
                                    class="secondary-button dropdown-button"
                                    onClick={() => this.setModalVisibility('isDataModalOpen', true)}
                                    type="button"
                                >
                                    Upload data
                                </button>
                                <button
                                    class="secondary-button dropdown-button"
                                    onClick={() => this.setModalVisibility('isBulkPriceModalOpen', true)}
                                    type="button"
                                >
                                    Update prices
                                </button>
                                <button
                                    class="secondary-button dropdown-button"
                                    onClick={() => this.setModalVisibility('isBulkTransactionModalOpen', true)}
                                    type="button"
                                >
                                    Bulk load transactions
                                </button>
                                <button
                                    class="secondary-button dropdown-button"
                                    onClick={this.downloadCurrentData}
                                    type="button"
                                >
                                    Download data
                                </button>
                                <button
                                    class="primary-button dropdown-button"
                                    onClick={() => this.setModalVisibility('isBuyModalOpen', true)}
                                    type="button"
                                >
                                    Add buy transaction
                                </button>
                                <button
                                    class="secondary-button dropdown-button"
                                    onClick={() => this.setModalVisibility('isSellModalOpen', true)}
                                    type="button"
                                >
                                    Add sell transaction
                                </button>
                            </div>
                        </details>
                    </div>
                </header>

                <main class="content-panel">
                    {error ? (
                        <div class="error-message">{error}</div>
                    ) : null}

                    {isLoading ? (
                        <div class="loading-state">Loading portfolio data...</div>
                    ) : (
                        <PortFolioTable portfolioRows={portfolioRows} groupBy={portfolioGroupBy} />
                    )}
                </main>

                <BuyTransactionModal
                    form={form}
                    securities={securities}
                    holdingEntities={holdingEntities}
                    isOpen={isBuyModalOpen}
                    onClose={() => this.setModalVisibility('isBuyModalOpen', false)}
                    onFieldChange={this.updateFormField}
                    onToggleSecurityMode={this.toggleBuySecurityMode}
                    onSubmit={this.handleSubmit}
                />

                <SellTransactionModal
                    form={activeSellForm}
                    securities={securities}
                    holdingEntities={holdingEntities}
                    isOpen={isSellModalOpen}
                    onClose={() => this.setModalVisibility('isSellModalOpen', false)}
                    onFieldChange={this.updateSellFormField}
                    onUpdateLotAllocation={this.updateSellLotAllocation}
                    onAssignAllUnitsToLot={this.assignAllUnitsToLot}
                    onSubmit={this.handleSellSubmit}
                    totalAllocatedUnits={totalAllocatedUnits}
                    sellUnitCount={sellUnitCount}
                    isAllocationValid={isAllocationValid}
                />

                <BulkPriceModal
                    form={bulkPriceForm}
                    isOpen={isBulkPriceModalOpen}
                    onClose={() => this.setModalVisibility('isBulkPriceModalOpen', false)}
                    onFieldChange={this.updateBulkPriceFormField}
                    onSubmit={this.handleBulkPriceSubmit}
                />

                <BulkTransactionModal
                    transactionLines={bulkTransactionForm.transactionLines}
                    isOpen={isBulkTransactionModalOpen}
                    onClose={() => this.setModalVisibility('isBulkTransactionModalOpen', false)}
                    onChange={(value) => this.setState((previousState) => ({
                        bulkTransactionForm: {
                            ...previousState.bulkTransactionForm,
                            transactionLines: value,
                        },
                    }))}
                    onSubmit={this.handleBulkTransactionSubmit}
                />

                <DataUploadModal
                    isOpen={isDataModalOpen}
                    onClose={() => this.setModalVisibility('isDataModalOpen', false)}
                    onUpload={this.handleDataUpload}
                />
            </div>
        );
    }
}

const appRoot = document.getElementById('app');
if (appRoot) {
    render(<App />, appRoot);
}
