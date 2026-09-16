import { ShareLot, ShareLotTransaction, ShareTransaction } from './data-model';
import { formatCurrency } from './formatters';

export interface ActivityReportFilters {
    fromDate: string;
    toDate: string;
    holdingEntity?: string;
    code?: string;
}

interface LotState {
    id: string;
    code: string;
    holdingEntity: string;
    units: number;
    originalCost: number;
    currentCost: number;
    buyTransactionId: string;
}

interface ReportGroup {
    holdingEntity: string;
    code: string;
    openingLots: LotState[];
    closingLots: LotState[];
    transactions: ShareTransaction[];
}

function timestampForDate(value: string, endOfDay: boolean): number {
    const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`);
    return date.getTime();
}

function formatDate(timestamp: number): string {
    return new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium' }).format(new Date(timestamp));
}

function formatDateTime(timestamp: number): string {
    return new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
}

function number(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number): string {
    return formatCurrency(value);
}

function cloneLots(lots: Map<string, LotState>): LotState[] {
    return Array.from(lots.values())
        .filter((lot) => lot.units > 0)
        .map((lot) => ({ ...lot }));
}

function getLotForLink(
    link: ShareLotTransaction,
    states: Map<string, LotState>,
    currentLots: Map<string, ShareLot>,
    buyTransactions: Map<string, ShareTransaction>,
): LotState | undefined {
    const linkedLotId = String(link.shareLot);
    const existing = states.get(linkedLotId);
    if (existing) {
        return existing;
    }

    const currentLot = currentLots.get(linkedLotId);
    if (!currentLot) {
        return undefined;
    }

    const buyTransaction = buyTransactions.get(String(currentLot.buyTransactionId));
    const state: LotState = {
        id: linkedLotId,
        code: currentLot.code,
        holdingEntity: currentLot.holdingEntity,
        units: number(currentLot.unitCount),
        originalCost: number(currentLot.unitOriginalCost ?? buyTransaction?.unitPrice),
        currentCost: number(currentLot.unitCurrentCost ?? buyTransaction?.unitPrice),
        buyTransactionId: String(currentLot.buyTransactionId),
    };
    states.set(linkedLotId, state);
    return state;
}

function createInitialStates(
    transactions: ShareTransaction[],
    lotLinks: ShareLotTransaction[],
    currentLots: Map<string, ShareLot>,
): Map<string, LotState> {
    const states = new Map<string, LotState>();
    const transactionMap = new Map(transactions.map((transaction) => [String(transaction.id), transaction]));

    for (const link of lotLinks) {
        const transaction = transactionMap.get(String(link.shareTransaction));
        const lot = currentLots.get(String(link.shareLot));
        if (transaction?.type !== 'buy' || !lot) {
            continue;
        }

        states.set(String(lot.id), {
            id: String(lot.id),
            code: lot.code,
            holdingEntity: lot.holdingEntity,
            units: number(transaction.unitCount),
            originalCost: number(lot.unitOriginalCost ?? transaction.unitPrice),
            currentCost: number(transaction.unitPrice),
            buyTransactionId: String(transaction.id),
        });
    }

    return states;
}

function applyTransaction(
    transaction: ShareTransaction,
    states: Map<string, LotState>,
    linksByTransaction: Map<string, ShareLotTransaction[]>,
    currentLots: Map<string, ShareLot>,
    transactionMap: Map<string, ShareTransaction>,
): void {
    const transactionId = String(transaction.id);
    if (transaction.type === 'buy') {
        const buyLink = linksByTransaction.get(transactionId)?.[0];
        if (buyLink && !states.has(String(buyLink.shareLot))) {
            const lot = currentLots.get(String(buyLink.shareLot));
            if (lot) {
                states.set(String(lot.id), {
                    id: String(lot.id),
                    code: lot.code,
                    holdingEntity: lot.holdingEntity,
                    units: number(transaction.unitCount),
                    originalCost: number(lot.unitOriginalCost ?? transaction.unitPrice),
                    currentCost: number(transaction.unitPrice),
                    buyTransactionId: transactionId,
                });
            }
        }
        return;
    }

    for (const link of linksByTransaction.get(transactionId) ?? []) {
        const state = getLotForLink(link, states, currentLots, transactionMap);
        if (!state) {
            continue;
        }

        if (transaction.type === 'sell') {
            state.units = Math.max(0, state.units - number(link.unitCount));
            if (state.units > 0) {
                const remainderId = Array.from(currentLots.values()).find((lot) => {
                    return String(lot.id) !== state.id
                        && String(lot.buyTransactionId) === state.buyTransactionId
                        && lot.code === state.code
                        && lot.holdingEntity === state.holdingEntity
                        && !states.has(String(lot.id));
                })?.id;

                if (remainderId !== undefined) {
                    states.set(String(remainderId), {
                        ...state,
                        id: String(remainderId),
                        units: state.units,
                    });
                    state.units = 0;
                }
            }
        } else if (transaction.type === 'etf-tax-statement' && transaction.finalized === true) {
            state.currentCost += number(link.unitCostDelta);
        }
    }
}

function describeTransaction(
    transaction: ShareTransaction,
    links: ShareLotTransaction[],
    currentLots: Map<string, ShareLot>,
    transactionMap: Map<string, ShareTransaction>,
): string[] {
    const lines = [`- **${transaction.type}** on ${formatDate(transaction.transactionTimestamp)} (ID: ${transaction.id})`];
    lines.push(`  - Units: ${number(transaction.unitCount)}; Unit price: ${money(number(transaction.unitPrice))}; Fees: ${money(number(transaction.fees))}`);

    if (transaction.type === 'buy') {
        const lot = links.length ? currentLots.get(String(links[0].shareLot)) : undefined;
        lines.push(`  - Lot: ${lot?.id ?? 'unlinked'}; Original price: ${money(number(lot?.unitOriginalCost ?? transaction.unitPrice))}; Current price: ${money(number(lot?.unitCurrentCost ?? transaction.unitPrice))}`);
    } else if (transaction.type === 'sell') {
        for (const link of links) {
            const lot = currentLots.get(String(link.shareLot));
            const buy = lot ? transactionMap.get(String(lot.buyTransactionId)) : undefined;
            lines.push(`  - Lot ${link.shareLot}: ${number(link.unitCount)} units sold at ${money(number(transaction.unitPrice))}; Original price: ${money(number(lot?.unitOriginalCost))}; Current price: ${money(number(lot?.unitCurrentCost))}; Buy transaction: ${buy?.id ?? 'unknown'}`);
            if (buy && number(link.unitCount) < number(buy.unitCount)) {
                lines.push(`  - New remainder lot: ${number(buy.unitCount) - number(link.unitCount)} shares remain from buy transaction ${buy.id}, retaining original price ${money(number(lot?.unitOriginalCost ?? buy.unitPrice))} and current price ${money(number(lot?.unitCurrentCost ?? buy.unitPrice))}.`);
            }
        }
    } else if (transaction.type === 'etf-tax-statement') {
        lines.push(`  - Cost adjustment: ${money(number(transaction.unitCostDelta))}; Finalized: ${transaction.finalized ? 'yes' : 'no'}`);
        for (const link of links) {
            lines.push(`  - Lot ${link.shareLot}: ${number(link.unitCount)} units adjusted by ${money(number(link.unitCostDelta))} per share`);
        }
    } else if (transaction.type === 'dividend') {
        lines.push(`  - Dividend per share: ${money(number(transaction.dividendPerShare))}; Securities: ${number(transaction.numberOfSecurities)}; Franked: ${money(number(transaction.totalFrankedAmount))}; Unfranked: ${money(number(transaction.totalUnfrankedAmount))}; Franking credit: ${money(number(transaction.totalFrankingCredit))}; Currency: ${transaction.originalCurrency ?? 'AUD'}`);
    }

    if (transaction.documentRef) {
        lines.push(`  - Document: ${transaction.documentRef}`);
    }
    return lines;
}

export function createActivityMarkdownReport(
    filters: ActivityReportFilters,
    holdingEntityNames: Map<string, string>,
    transactions: ShareTransaction[],
    lots: ShareLot[],
    lotLinks: ShareLotTransaction[],
): string {
    const fromTimestamp = timestampForDate(filters.fromDate, false);
    const toTimestamp = timestampForDate(filters.toDate, true);
    const currentLots = new Map(lots.map((lot) => [String(lot.id), lot]));
    const transactionMap = new Map(transactions.map((transaction) => [String(transaction.id), transaction]));
    const linksByTransaction = new Map<string, ShareLotTransaction[]>();

    for (const link of lotLinks) {
        const existing = linksByTransaction.get(String(link.shareTransaction)) ?? [];
        existing.push(link);
        linksByTransaction.set(String(link.shareTransaction), existing);
    }

    const relevantTransactions = transactions
        .filter((transaction) => transaction.transactionTimestamp <= toTimestamp)
        .filter((transaction) => !filters.holdingEntity || transaction.holdingEntity === filters.holdingEntity)
        .filter((transaction) => !filters.code || transaction.code.toLowerCase() === filters.code.toLowerCase())
        .sort((left, right) => left.transactionTimestamp - right.transactionTimestamp);

    const states = createInitialStates(relevantTransactions, lotLinks, currentLots);
    const openingStates = new Map<string, LotState>();

    for (const transaction of relevantTransactions) {
        if (transaction.transactionTimestamp < fromTimestamp) {
            applyTransaction(transaction, states, linksByTransaction, currentLots, transactionMap);
        }
    }

    for (const [id, state] of states) {
        if (state.units > 0) {
            openingStates.set(id, { ...state });
        }
    }

    for (const transaction of relevantTransactions) {
        if (transaction.transactionTimestamp >= fromTimestamp) {
            applyTransaction(transaction, states, linksByTransaction, currentLots, transactionMap);
        }
    }

    const groupKeys = new Set<string>();
    for (const state of [...openingStates.values(), ...states.values()]) {
        groupKeys.add(`${state.holdingEntity}|${state.code}`);
    }
    for (const transaction of relevantTransactions.filter((entry) => entry.transactionTimestamp >= fromTimestamp)) {
        groupKeys.add(`${transaction.holdingEntity}|${transaction.code}`);
    }

    const groups: ReportGroup[] = Array.from(groupKeys).sort().map((key) => {
        const [holdingEntity, code] = key.split('|');
        return {
            holdingEntity,
            code,
            openingLots: Array.from(openingStates.values()).filter((lot) => lot.holdingEntity === holdingEntity && lot.code === code),
            closingLots: Array.from(states.values()).filter((lot) => lot.holdingEntity === holdingEntity && lot.code === code && lot.units > 0),
            transactions: relevantTransactions.filter((transaction) => transaction.transactionTimestamp >= fromTimestamp && transaction.holdingEntity === holdingEntity && transaction.code === code),
        };
    });

    const preparedAt = Date.now();
    const filterLines = [
        `- Date range: ${formatDate(fromTimestamp)} to ${formatDate(toTimestamp)}`,
        `- Holding entity: ${filters.holdingEntity ? holdingEntityNames.get(filters.holdingEntity) ?? filters.holdingEntity : 'All'}`,
        `- Share code: ${filters.code || 'All'}`,
    ];
    const lines = [`# Share Transaction Activity Report`, '', `Prepared: ${formatDateTime(preparedAt)}`, ...filterLines, ''];

    if (groups.length === 0) {
        lines.push('No activity or open lots matched the selected filters and date range.');
        return lines.join('\n');
    }

    for (const group of groups) {
        const openingUnits = group.openingLots.reduce((sum, lot) => sum + lot.units, 0);
        const closingUnits = group.closingLots.reduce((sum, lot) => sum + lot.units, 0);
        const originalCost = group.closingLots.reduce((sum, lot) => sum + lot.units * lot.originalCost, 0);
        const currentCost = group.closingLots.reduce((sum, lot) => sum + lot.units * lot.currentCost, 0);
        const averageOriginalCost = closingUnits ? originalCost / closingUnits : 0;
        const averageCurrentCost = closingUnits ? currentCost / closingUnits : 0;

        lines.push(`## ${holdingEntityNames.get(group.holdingEntity) ?? group.holdingEntity} - ${group.code}`, '');
        lines.push(`### Opening position (${formatDate(fromTimestamp)})`, `- Open lots: ${group.openingLots.length}`, `- Open shares: ${openingUnits}`, '');
        lines.push('### Activity');
        for (const transaction of group.transactions) {
            lines.push(...describeTransaction(transaction, linksByTransaction.get(String(transaction.id)) ?? [], currentLots, transactionMap));
        }
        if (group.transactions.length === 0) {
            lines.push('- No transactions occurred during this period.');
        }
        lines.push('', `### Closing position (${formatDate(toTimestamp)})`, `- Open lots: ${group.closingLots.length}`, `- Open shares: ${closingUnits}`, `- Average original cost price: ${money(averageOriginalCost)}`, `- Average current cost price: ${money(averageCurrentCost)}`, '');
    }

    return lines.join('\n');
}