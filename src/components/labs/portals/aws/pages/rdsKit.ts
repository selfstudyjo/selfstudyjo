/** Engine names the RDS console prints. */
export const ENGINE_LABELS: Record<string, string> = {
    postgres: 'PostgreSQL', mysql: 'MySQL Community', mariadb: 'MariaDB',
    'sqlserver-ex': 'SQL Server Express Edition', 'oracle-se2': 'Oracle Standard Edition Two',
};

export function engineLabel(engine: string): string {
    return ENGINE_LABELS[engine] || engine;
}

export const DEFAULT_USER: Record<string, string> = {
    postgres: 'postgres', mysql: 'admin', mariadb: 'admin', 'sqlserver-ex': 'admin', 'oracle-se2': 'admin',
};
