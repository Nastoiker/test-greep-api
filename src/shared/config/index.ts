import { parseEnv } from './env';
export { parseEnv } from './env';
export const config = parseEnv(import.meta.env ?? {});
