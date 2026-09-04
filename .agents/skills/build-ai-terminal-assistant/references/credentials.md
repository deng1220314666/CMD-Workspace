# Credentials

## Storage design

Use the installed Electron version's supported `safeStorage` capability in the main process. Prefer asynchronous encryption/decryption APIs when available. Check availability only after the application is ready and handle temporary unavailability explicitly.

Store encrypted bytes in an application-owned file beneath the Electron `userData` directory, or reuse an existing approved credential repository. Use an atomic write pattern and restrictive permissions where the platform supports them. PostgreSQL stores only a random credential ID and nonsecret metadata.

Do not introduce an abandoned keychain dependency when Electron's built-in mechanism satisfies the supported platforms. Do not fall back silently to plaintext.

## Interface

The internal main-process service may expose:

```ts
interface CredentialService {
  set(id: string, secret: string): Promise<void>;
  has(id: string): Promise<boolean>;
  delete(id: string): Promise<void>;
  resolve(id: string): Promise<string>; // main-process callers only
}
```

The preload must not expose `resolve` or any equivalent read-back API. Renderer-visible operations are limited to setting a new value, checking presence/status, and deleting it.

## Lifecycle

- Generate credential IDs independently of provider names.
- Trim accidental surrounding whitespace only when the provider's key format permits it.
- Never validate by echoing a key.
- Replace atomically so a failed write preserves the previous valid credential.
- Delete credential material when its provider is deleted, unless another configuration intentionally shares the same credential reference.
- Clear resolved key strings and provider clients from long-lived caches where practical.
- Never include a secret in thrown messages or serialized causes.

## Platform behavior

- Windows protection is tied to OS cryptographic facilities and the current user context; it is not protection from every process running as that same user.
- macOS identity may depend on stable code signing across releases.
- Linux secure-storage semantics depend on the available desktop secret store. Detect insecure/unavailable fallback modes and block secret persistence or require an explicit product decision; never claim secure storage when it is unavailable.

## Leakage audit

Search the resulting change and tests for:

- Key literals and common prefixes.
- Request authorization headers.
- Renderer payloads containing secrets.
- `console.*`, logger metadata, error serialization, telemetry, crash reports, database inserts, browser storage, Redux/Zustand persistence, snapshots, and exports.

Tests should use unmistakably fake keys and verify redaction without committing real credentials.
