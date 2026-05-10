declare module "better-sqlite3" {
    type Statement = {
        run: (...params: unknown[]) => unknown;
        get: (...params: unknown[]) => unknown;
        all: (...params: unknown[]) => unknown[];
    };

    export default class Database {
        constructor(path: string);
        prepare(sql: string): Statement;
        exec(sql: string): void;
        pragma(sql: string): void;
    }
}
