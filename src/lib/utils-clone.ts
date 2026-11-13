export const cloneDeep = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
