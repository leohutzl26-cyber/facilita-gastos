'use client';
import { createClient } from '@/utils/supabase/client';

/*
 * Cola de gastos del colaborador para trabajar sin conexión.
 * Todo gasto se guarda primero aquí (IndexedDB) y solo se borra cuando el
 * servidor confirma que lo recibió, así que un corte de señal, un cierre de la
 * app o un error del servidor nunca hacen perder un gasto.
 */

const DB_NAME = 'facilita-gastos-offline';
const DB_VERSION = 1;
const QUEUE_STORE = 'queue';
const META_STORE = 'meta';
const LEGACY_QUEUE_KEY = 'offline_receipts';
const LAST_USER_KEY = 'fg-last-user';
const SEND_TIMEOUT_MS = 60_000;

export const QUEUE_CHANGED_EVENT = 'fg-queue-changed';

export type ReceiptPayload = {
    merchant: string;
    merchant_rut?: string;
    document_type?: string;
    document_number?: string;
    amount: string;
    date: string;
    category: string;
    project_id?: string;
    location?: string;
    imageBase64: string | null;
};

export type QueuedReceipt = {
    id: string;
    userId: string | null;
    createdAt: number;
    status: 'pending' | 'rejected';
    attempts: number;
    lastError?: string;
    payload: ReceiptPayload;
};

export type SendResult =
    | { kind: 'ok' }
    | { kind: 'network' }
    | { kind: 'auth' }
    | { kind: 'retry'; message: string }
    | { kind: 'rejected'; message: string };

export type SyncSummary = {
    sent: number;
    rejected: number;
    remaining: number;
    blocked: 'auth' | 'network' | null;
};

export type SubmitOutcome =
    | { kind: 'sent' }
    | { kind: 'queued'; reason: 'offline' | 'auth' | 'network' }
    | { kind: 'rejected'; message: string };

// ───────────── IndexedDB ─────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
                if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: 'key' });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => {
                dbPromise = null;
                reject(request.error);
            };
        });
    }
    return dbPromise;
}

async function run<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openDb();
    return new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const request = action(tx.objectStore(storeName));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

function notifyChanged() {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
}

function newId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ───────────── Usuario actual ─────────────

// getSession() lee la sesión guardada en el teléfono, pero con el token vencido
// y sin señal devuelve null; por eso se recuerda el último usuario conocido.
export async function getCurrentUserId(): Promise<string | null> {
    try {
        const { data } = await createClient().auth.getSession();
        const id = data.session?.user?.id ?? null;
        if (id) {
            localStorage.setItem(LAST_USER_KEY, id);
            return id;
        }
    } catch {
        // sin sesión legible: se usa el último usuario conocido
    }
    try {
        return localStorage.getItem(LAST_USER_KEY);
    } catch {
        return null;
    }
}

export function forgetCurrentUser() {
    try {
        localStorage.removeItem(LAST_USER_KEY);
    } catch {
        // nada que olvidar
    }
}

// ───────────── Cola ─────────────

export async function listQueue(userId: string | null): Promise<QueuedReceipt[]> {
    const all = await run<QueuedReceipt[]>(QUEUE_STORE, 'readonly', (store) => store.getAll());
    return all
        .filter((item) => item.userId === userId || item.userId === null)
        .sort((a, b) => a.createdAt - b.createdAt);
}

async function getItem(id: string): Promise<QueuedReceipt | undefined> {
    return run<QueuedReceipt | undefined>(QUEUE_STORE, 'readonly', (store) => store.get(id));
}

async function updateItem(id: string, patch: Partial<QueuedReceipt>) {
    const current = await getItem(id);
    if (!current) return;
    await run(QUEUE_STORE, 'readwrite', (store) => store.put({ ...current, ...patch }));
}

export async function enqueueReceipt(payload: ReceiptPayload): Promise<QueuedReceipt> {
    const item: QueuedReceipt = {
        id: newId(),
        userId: await getCurrentUserId(),
        createdAt: Date.now(),
        status: 'pending',
        attempts: 0,
        payload,
    };
    await run(QUEUE_STORE, 'readwrite', (store) => store.put(item));
    notifyChanged();
    return item;
}

export async function removeFromQueue(id: string) {
    await run(QUEUE_STORE, 'readwrite', (store) => store.delete(id));
    notifyChanged();
}

export async function retryQueuedReceipt(id: string) {
    await updateItem(id, { status: 'pending', lastError: undefined });
    notifyChanged();
}

// Pasa a IndexedDB los gastos que versiones anteriores dejaban en localStorage.
export async function migrateLegacyQueue() {
    let raw: string | null = null;
    try {
        raw = localStorage.getItem(LEGACY_QUEUE_KEY);
    } catch {
        return;
    }
    if (!raw) return;

    let legacy: unknown;
    try {
        legacy = JSON.parse(raw);
    } catch {
        return;
    }
    if (!Array.isArray(legacy)) return;

    const userId = await getCurrentUserId();
    for (const payload of legacy) {
        const item: QueuedReceipt = {
            id: newId(),
            userId,
            createdAt: Date.now(),
            status: 'pending',
            attempts: 0,
            payload: payload as ReceiptPayload,
        };
        await run(QUEUE_STORE, 'readwrite', (store) => store.put(item));
    }
    localStorage.removeItem(LEGACY_QUEUE_KEY);
    notifyChanged();
}

// ───────────── Envío ─────────────

async function readJson(response: Response): Promise<{ success?: boolean; error?: string } | null> {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

export async function sendReceipt(payload: ReceiptPayload): Promise<SendResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    let response: Response;
    try {
        response = await fetch('/api/worker/receipts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
    } catch {
        return { kind: 'network' };
    } finally {
        clearTimeout(timer);
    }

    const body = await readJson(response);

    if (response.ok) {
        // Un portal de wifi (hotel, aeropuerto) responde 200 con su propia página:
        // solo cuenta como recibido si es la respuesta real de la API.
        return body?.success === true ? { kind: 'ok' } : { kind: 'network' };
    }
    if (response.status === 401 || response.status === 403) return { kind: 'auth' };

    const message = body?.error || `Error ${response.status} al subir el recibo`;
    if (response.status === 408 || response.status === 429 || response.status >= 500) {
        return { kind: 'retry', message };
    }
    return { kind: 'rejected', message };
}

let syncRunning = false;

async function runSync(onlyId?: string): Promise<SyncSummary> {
    const userId = await getCurrentUserId();
    const summary: SyncSummary = { sent: 0, rejected: 0, remaining: 0, blocked: null };
    if (!userId) {
        summary.blocked = 'auth';
        return summary;
    }

    const pending = (await listQueue(userId)).filter((item) => item.status === 'pending' && (!onlyId || item.id === onlyId));

    for (const item of pending) {
        const result = await sendReceipt(item.payload);

        if (result.kind === 'ok') {
            await removeFromQueue(item.id);
            summary.sent++;
            continue;
        }
        if (result.kind === 'rejected') {
            await updateItem(item.id, { status: 'rejected', attempts: item.attempts + 1, lastError: result.message });
            notifyChanged();
            summary.rejected++;
            continue;
        }

        // Sin red, sesión vencida o servidor caído: se conserva y se deja de insistir,
        // porque el resto fallaría igual.
        await updateItem(item.id, {
            attempts: item.attempts + 1,
            lastError: result.kind === 'retry' ? result.message : undefined,
        });
        notifyChanged();
        summary.blocked = result.kind === 'auth' ? 'auth' : 'network';
        break;
    }

    summary.remaining = (await listQueue(userId)).filter((item) => item.status === 'pending').length;
    return summary;
}

// Envía los gastos pendientes de a uno. Devuelve null si no corresponde intentar
// (sin conexión o ya hay otro envío en curso).
export async function syncQueue(options: { onlyId?: string } = {}): Promise<SyncSummary | null> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;

    if (typeof navigator !== 'undefined' && navigator.locks) {
        return navigator.locks.request('fg-queue-sync', { ifAvailable: true }, async (lock) => {
            return lock ? runSync(options.onlyId) : null;
        });
    }

    if (syncRunning) return null;
    syncRunning = true;
    try {
        return await runSync(options.onlyId);
    } finally {
        syncRunning = false;
    }
}

// Guarda el gasto en la cola, intenta enviarlo y cuenta qué pasó, para que
// el formulario le diga al usuario si quedó enviado o guardado en el teléfono.
export async function submitReceipt(payload: ReceiptPayload): Promise<SubmitOutcome> {
    const item = await enqueueReceipt(payload);
    const summary = await syncQueue({ onlyId: item.id });

    const current = await getItem(item.id);
    if (!current) return { kind: 'sent' };

    if (current.status === 'rejected') {
        // El usuario sigue en el formulario: se saca de la cola para que lo corrija.
        await removeFromQueue(item.id);
        return { kind: 'rejected', message: current.lastError || 'No se pudo subir el recibo' };
    }

    if (summary?.blocked === 'auth') return { kind: 'queued', reason: 'auth' };
    if (summary === null && navigator.onLine === false) return { kind: 'queued', reason: 'offline' };
    return { kind: 'queued', reason: 'network' };
}

// ───────────── Copia local de listas (categorías, proyectos, historial) ─────────────

export async function cacheSet(key: string, value: unknown) {
    try {
        await run(META_STORE, 'readwrite', (store) => store.put({ key, value, savedAt: Date.now() }));
    } catch {
        // sin almacenamiento disponible: solo se pierde la copia sin conexión
    }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
    try {
        const row = await run<{ value: T } | undefined>(META_STORE, 'readonly', (store) => store.get(key));
        return row ? row.value : null;
    } catch {
        return null;
    }
}

// ───────────── Preparar la app para uso sin conexión ─────────────

export function requestOfflineWarmup() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    // Se le pide al service worker que controla esta pantalla. Tras una actualización
    // el primero en responder es el viejo (que ignora el pedido), así que también se
    // reenvía cuando el nuevo toma el control.
    const send = () => navigator.serviceWorker.controller?.postMessage({ type: 'WARM_PAGES' });
    navigator.serviceWorker.ready.then(send).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', send, { once: true });

    Promise.resolve(navigator.storage?.persist?.()).catch(() => {});
}
