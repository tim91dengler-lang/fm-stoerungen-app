import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, AtSign, MessageSquare, UserCheck, Activity, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { notificationApi } from '../api/endpoints';
import type { NotificationRead, NotificationTyp } from '../api/types';

const TYP_ICON: Record<NotificationTyp, typeof Bell> = {
  mention: AtSign,
  chat: MessageSquare,
  zuweisung: UserCheck,
  status: Activity,
  wartung_faellig: Wrench,
};

const TYP_COLOR: Record<NotificationTyp, string> = {
  mention: 'text-violet-300',
  chat: 'text-sky-300',
  zuweisung: 'text-emerald-300',
  status: 'text-amber-300',
  wartung_faellig: 'text-orange-300',
};

function relativeTime(iso: string): string {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now - t);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days === 1 ? '' : 'en'}`;
}

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: countData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => notificationApi.count(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['notifications-list'],
    queryFn: () => notificationApi.list(20),
    enabled: open,
    staleTime: 10_000,
  });

  const unread = countData?.unread ?? 0;

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  async function markOne(n: NotificationRead) {
    if (!n.gelesen) {
      await notificationApi.markRead([n.id]);
      qc.invalidateQueries({ queryKey: ['notifications-count'] });
      qc.invalidateQueries({ queryKey: ['notifications-list'] });
    }
  }

  async function markAll() {
    await notificationApi.markAllRead();
    qc.invalidateQueries({ queryKey: ['notifications-count'] });
    qc.invalidateQueries({ queryKey: ['notifications-list'] });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 lg:min-h-0 lg:min-w-0"
        title="Benachrichtigungen"
        aria-label="Benachrichtigungen"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-96 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
            <div className="text-sm font-semibold text-zinc-100">
              Benachrichtigungen
              {unread > 0 && (
                <span className="ml-2 text-xs font-normal text-zinc-400">
                  ({unread} ungelesen)
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                Alle als gelesen
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">
                Keine Benachrichtigungen
              </div>
            ) : (
              items.map((n) => {
                const Icon = TYP_ICON[n.typ] ?? Bell;
                const colorClass = TYP_COLOR[n.typ] ?? 'text-zinc-300';
                const target = n.ticket_id ? `/tickets/${n.ticket_id}` : '#';
                return (
                  <Link
                    key={n.id}
                    to={target}
                    onClick={() => {
                      void markOne(n);
                      setOpen(false);
                    }}
                    className={clsx(
                      'flex items-start gap-3 border-b border-zinc-800/60 px-4 py-3 hover:bg-zinc-800/40',
                      !n.gelesen && 'bg-emerald-500/5',
                    )}
                  >
                    <div className={clsx('mt-0.5 shrink-0', colorClass)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-zinc-100">
                        {n.text}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                        <span>{relativeTime(n.created_at)}</span>
                        {n.ausloeser && (
                          <span className="truncate">· {n.ausloeser.full_name}</span>
                        )}
                      </div>
                    </div>
                    {!n.gelesen && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    )}
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
