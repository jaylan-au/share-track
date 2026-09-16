export const currencyFormatter = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
});

export function formatCurrency(value: number): string {
    return currencyFormatter.format(value);
}