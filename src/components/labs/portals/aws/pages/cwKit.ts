/** CloudWatch Logs retention choices, as the console lists them. */
export const RETENTION = [1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653];

export function retentionLabel(days: number): string {
    if (days < 30) return `${days} day${days === 1 ? '' : 's'}`;
    if (days < 365) return `${Math.round(days / 30)} month${days < 60 ? '' : 's'}`;
    const years = Math.round(days / 365);
    return days === 400 || days === 545 ? `${Math.round(days / 30)} months` : `${years} year${years === 1 ? '' : 's'}`;
}
