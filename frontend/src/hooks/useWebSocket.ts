"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getWebSocketUrl, MonitoringEvent } from "@/lib/api";

export interface MonitoringUpdate {
  stats?: Record<string, number>;
  health?: { equipment_code: string; health_score: number; risk_level: string; rul_cycles?: number }[];
  alerts?: { id: number; title: string; level: string; source?: string }[];
}

export function useWebSocket(
  onUpdate?: (data: MonitoringUpdate) => void,
  onSensorTick?: (data: { equipment_code: string; cycle: number }) => void
) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const onTickRef = useRef(onSensorTick);
  onUpdateRef.current = onUpdate;
  onTickRef.current = onSensorTick;

  useEffect(() => {
    const ws = new WebSocket(getWebSocketUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setLastEvent("connected");
    };
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        setLastEvent(msg.type);
        if (msg.type === "monitoring_update" && onUpdateRef.current) {
          onUpdateRef.current(msg.data);
        }
        if (msg.type === "sensor_tick" && onTickRef.current) {
          onTickRef.current(msg.data);
        }
      } catch {
        /* ignore */
      }
    };

    return () => ws.close();
  }, []);

  return { connected, lastEvent };
}

export function useLiveEventFeed(pollMs = 5000) {
  const [events, setEvents] = useState<MonitoringEvent[]>([]);

  const refresh = useCallback(async () => {
    try {
      const { api } = await import("@/lib/api");
      const res = await api.getMonitoringEvents(50);
      setEvents(res.events);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, pollMs);
    return () => clearInterval(t);
  }, [refresh, pollMs]);

  const prepend = useCallback((e: MonitoringEvent) => {
    setEvents((prev) => [e, ...prev].slice(0, 50));
  }, []);

  return { events, refresh, prepend };
}
