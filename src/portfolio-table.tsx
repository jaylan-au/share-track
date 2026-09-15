import { Component } from 'preact';

interface PortFolioTableRowProps {
    portfolioRow: {
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
    };
    groupBy: 'security' | 'security-entity';
}

const currencyFormatter = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const percentageFormatter = new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

class PortFolioTableRow extends Component<PortFolioTableRowProps> {
    render() {
        const { portfolioRow, groupBy } = this.props;
        const showEntityColumn = groupBy === 'security-entity';

        const profitClass = portfolioRow.profitPercent >= 0 ? 'profit-positive' : 'profit-negative';

        return (
            <tr id={portfolioRow.id}>
                {showEntityColumn ? <td>{portfolioRow.entity}</td> : null}
                <td>{portfolioRow.code}</td>
                <td>{portfolioRow.unitCount}</td>
                <td>
                    <div class="metric-value-group">
                        <span>{currencyFormatter.format(portfolioRow.unitCostAverage)}</span>
                        <small>({currencyFormatter.format(portfolioRow.unitOriginalCostAverage)})</small>
                    </div>
                </td>
                <td>{currencyFormatter.format(portfolioRow.currentPrice)}</td>
                <td>{currencyFormatter.format(portfolioRow.totalCost)}</td>
                <td>{currencyFormatter.format(portfolioRow.currentValue)}</td>
                <td class={profitClass}>
                    {`${percentageFormatter.format(portfolioRow.profitPercent)}%`}
                </td>
                <td class={profitClass}>
                    {currencyFormatter.format(portfolioRow.profitPosition)}
                </td>
            </tr>
        );
    }
}

export function PortFolioTable(props: any) {
    const { portfolioRows, groupBy } = props;
    const showEntityColumn = groupBy === 'security-entity';

    const totalCost = portfolioRows.reduce((sum: number, row: any) => sum + Number(row.totalCost ?? 0), 0);
    const totalCurrentValue = portfolioRows.reduce((sum: number, row: any) => sum + Number(row.currentValue ?? 0), 0);
    const totalProfit = portfolioRows.reduce((sum: number, row: any) => sum + Number(row.profitPosition ?? 0), 0);
    const averageProfitPercent = portfolioRows.length > 0
        ? portfolioRows.reduce((sum: number, row: any) => sum + Number(row.profitPercent ?? 0), 0) / portfolioRows.length
        : 0;

    return (
        <div class="portfolio-table">
            <table>
                <thead>
                    <tr>
                        {showEntityColumn ? <th>Entity</th> : null}
                        <th>Code</th>
                        <th>Unit Count</th>
                        <th>Unit Cost Average</th>
                        <th>Current Price</th>
                        <th>Total Cost</th>
                        <th>Current Value</th>
                        <th>Profit %</th>
                        <th>Simple Gain/Loss</th>
                    </tr>
                </thead>
                <tbody>
                    {portfolioRows.map((row: any) => (
                        <PortFolioTableRow key={row.id} portfolioRow={row} groupBy={groupBy} />
                    ))}
                </tbody>
                <tfoot>
                    <tr class="portfolio-summary-row">
                        {showEntityColumn ? <td colSpan={5}>Summary</td> : <td colSpan={4}>Summary</td>}
                        <td>{currencyFormatter.format(totalCost)}</td>
                        <td>{currencyFormatter.format(totalCurrentValue)}</td>
                        <td>{`${percentageFormatter.format(averageProfitPercent)}%`}</td>
                        <td>{currencyFormatter.format(totalProfit)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}