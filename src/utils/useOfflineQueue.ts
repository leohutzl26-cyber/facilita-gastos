'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    QUEUE_CHANGED_EVENT,
    getCurrentUserId,
    listQueue,
    migrateLegacyQueue,
    removeFromQueue,
    retryQueuedReceipt,
    syncQueue,
    type QueuedReceipt,
    type SyncSummary,
} from '@/utils/offlineQueue';

const RETRY_EVERY_MS = 20_000;
const SUMMARY_VISIBLE_MS = 6_000;

// Estado de la conexión y de los gastos pendientes de envío. Reintenta solo:
// al volver la señal, al volver a abrir la app y cada pocos segundos mientras
// haya gastos en espera (iPhone no permite sincronizar en segundo plano).
export function useOfflineQueue() {
    const [online, setOnline] = useState(true);
    const [items, setItems] = useState<QueuedReceipt[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [summary, setSummary] = useState<SyncSummary | null>(null);
    const syncingRef = useRef(false);

    const refresh = useCallback(async () => {
        try {
            setItems(await listQueue(await getCurrentUserId()));
        } catch {
            // IndexedDB no disponible: no hay cola que mostrar
        }
    }, []);

    const syncNow = useCallback(async () => {
        if (syncingRef.current) return;
        syncingRef.current = true;
        setSyncing(true);
        try {
            const result = await syncQueue();
            if (result) setSummary(result);
        } finally {
            syncingRef.current = false;
            setSyncing(false);
            await refresh();
        }
    }, [refresh]);

    useEffect(() => {
        setOnline(navigator.onLine);
        let active = true;

        (async () => {
            try {
                await migrateLegacyQueue();
            } catch {
                // se reintenta en la próxima visita
            }
            if (!active) return;
            await refresh();
            if (navigator.onLine) syncNow();
        })();

        const handleOnline = () => {
            setOnline(true);
            syncNow();
        };
        const handleOffline = () => setOnline(false);
        const handleVisible = () => {
            if (document.visibilityState !== 'visible') return;
            setOnline(navigator.onLine);
            if (navigator.onLine) syncNow();
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        window.addEventListener(QUEUE_CHANGED_EVENT, refresh);
        document.addEventListener('visibilitychange', handleVisible);
        return () => {
            active = false;
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener(QUEUE_CHANGED_EVENT, refresh);
            document.removeEventListener('visibilitychange', handleVisible);
        };
    }, [refresh, syncNow]);

    const pendingCount = items.filter((item) => item.status === 'pending').length;

    useEffect(() => {
        if (!online || pendingCount === 0) return;
        const timer = setInterval(syncNow, RETRY_EVERY_MS);
        return () => clearInterval(timer);
    }, [online, pendingCount, syncNow]);

    useEffect(() => {
        if (!summary || summary.sent === 0) return;
        const timer = setTimeout(() => setSummary(null), SUMMARY_VISIBLE_MS);
        return () => clearTimeout(timer);
    }, [summary]);

    const discard = useCallback(async (id: string) => {
        await removeFromQueue(id);
    }, []);

    const retry = useCallback(async (id: string) => {
        await retryQueuedReceipt(id);
        syncNow();
    }, [syncNow]);

    return { online, items, pendingCount, syncing, summary, syncNow, discard, retry, refresh };
}

export type OfflineQueue = ReturnType<typeof useOfflineQueue>;
