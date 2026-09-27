/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GREEN_API_URL?: string;
  readonly VITE_REQUEST_TIMEOUT_MS?: string;
  readonly VITE_RECEIVE_TIMEOUT_SECONDS?: string;
  readonly VITE_POLL_INTERVAL_MS?: string;
  readonly VITE_RETRY_INITIAL_MS?: string;
  readonly VITE_RETRY_MAX_MS?: string;
}
