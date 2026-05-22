import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { chatApi, userApi } from '../api/endpoints';
import { useAuth } from '../contexts/AuthContext';
import { formatRelativeDateTime } from '../lib/format';
import type { TicketMessageRead } from '../api/types';

interface Props {
  ticketId: string;
}

function initials(fullName?: string | null): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

const MENTION_REGEX = /@([\wÄÖÜäöüß]+(?:\s+[\wÄÖÜäöüß]+)?)/g;

export function ChatPanel({ ticketId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  const messagesQuery = useQuery({
    queryKey: ['ticket-messages', ticketId],
    queryFn: () => chatApi.list(ticketId),
    refetchInterval: 5_000, // Polling alle 5s — Slice-2-Anforderung, Slice 3: WebSocket
    refetchIntervalInBackground: false,
  });

  const usersQuery = useQuery({
    queryKey: ['users-for-mentions'],
    queryFn: () => userApi.list({ limit: 200 }),
    staleTime: 60_000,
  });

  const send = useMutation({
    mutationFn: (payload: { text: string; mentions: string[] }) =>
      chatApi.create(ticketId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket-messages', ticketId] });
      setText('');
    },
  });

  const remove = useMutation({
    mutationFn: (mid: string) => chatApi.remove(ticketId, mid),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['ticket-messages', ticketId] }),
  });

  // Auto-scroll an's Ende, wenn neue Nachrichten ankommen
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesQuery.data?.length]);

  const mentionCandidates = useMemo(() => {
    const all = usersQuery.data?.items ?? [];
    if (!mentionFilter) return all.slice(0, 6);
    const q = mentionFilter.toLowerCase();
    return all
      .filter((u) => u.full_name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [usersQuery.data, mentionFilter]);

  function onTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setText(next);
    // Mention-Trigger: letzten "@token" extrahieren
    const cursor = e.target.selectionStart;
    const upToCursor = next.slice(0, cursor);
    const lastAt = upToCursor.lastIndexOf('@');
    if (lastAt >= 0) {
      const between = upToCursor.slice(lastAt + 1);
      // nur wenn nach @ kein Whitespace folgt → Menü öffnen
      if (!/\s{2,}/.test(between)) {
        setMentionFilter(between);
        setMentionMenuOpen(true);
        return;
      }
    }
    setMentionMenuOpen(false);
  }

  function insertMention(userName: string) {
    if (!textareaRef.current) return;
    const ta = textareaRef.current;
    const cursor = ta.selectionStart;
    const upToCursor = text.slice(0, cursor);
    const lastAt = upToCursor.lastIndexOf('@');
    if (lastAt < 0) return;
    const before = text.slice(0, lastAt);
    const after = text.slice(cursor);
    const next = `${before}@${userName} ${after}`;
    setText(next);
    setMentionMenuOpen(false);
    // Cursor hinter den Namen + Leerzeichen setzen
    requestAnimationFrame(() => {
      const pos = before.length + userName.length + 2;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || send.isPending) return;
    // Mentions aus Text-Namen → UUIDs auflösen
    const userMap = new Map(
      (usersQuery.data?.items ?? []).map((u) => [u.full_name, u.id]),
    );
    const matches = Array.from(trimmed.matchAll(MENTION_REGEX))
      .map((m) => m[1])
      .filter((name): name is string => Boolean(name));
    const mentionIds = matches
      .map((name) => userMap.get(name))
      .filter((id): id is string => Boolean(id));
    send.mutate({ text: trimmed, mentions: mentionIds });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !mentionMenuOpen) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setMentionMenuOpen(false);
    }
  }

  const messages = messagesQuery.data ?? [];

  return (
    <details
      open
      className="group rounded-md border border-zinc-800 bg-zinc-900"
    >
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200">
        <MessageSquare className="h-3.5 w-3.5" />
        Chat zum Ticket
        {messages.length > 0 && (
          <span className="ml-1 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
            {messages.length}
          </span>
        )}
      </summary>
      <div className="border-t border-zinc-800 p-3">
        <div className="mb-3 max-h-72 space-y-3 overflow-y-auto pr-1">
          {messagesQuery.isLoading && (
            <div className="text-xs text-zinc-500">Lade …</div>
          )}
          {!messagesQuery.isLoading && messages.length === 0 && (
            <div className="text-xs text-zinc-500">
              Noch keine Nachrichten zu diesem Ticket.
              <br />
              Tipp: @Name um jemanden zu erwähnen.
            </div>
          )}
          {messages.map((m) => (
            <MessageRow
              key={m.id}
              message={m}
              isOwn={m.autor?.id === user?.id}
              onDelete={() => {
                if (confirm('Nachricht löschen?')) remove.mutate(m.id);
              }}
            />
          ))}
          <div ref={listEndRef} />
        </div>

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={onTextareaChange}
            onKeyDown={onKeyDown}
            placeholder="Nachricht schreiben — @ für Erwähnung, Enter zum Senden, Shift+Enter für Zeilenumbruch"
            rows={2}
            className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500/60 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
          />
          {mentionMenuOpen && mentionCandidates.length > 0 && (
            <div className="absolute bottom-full left-0 z-30 mb-1 w-64 rounded-md border border-zinc-800 bg-zinc-900 p-1 shadow-2xl">
              {mentionCandidates.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => insertMention(u.full_name)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-zinc-800"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/20 text-[10px] font-semibold text-emerald-300">
                    {initials(u.full_name)}
                  </span>
                  {u.full_name}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">
              Polling alle 5s — neue Nachrichten erscheinen automatisch.
            </span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim() || send.isPending}
              className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400 disabled:bg-zinc-700 disabled:text-zinc-500"
            >
              <Send className="h-3.5 w-3.5" />
              Senden
            </button>
          </div>
        </div>
      </div>
    </details>
  );
}

function MessageRow({
  message,
  isOwn,
  onDelete,
}: {
  message: TicketMessageRead;
  isOwn: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/20 text-[10px] font-semibold text-emerald-300">
        {initials(message.autor?.full_name)}
      </div>
      <div className="min-w-0 flex-1 rounded-md bg-zinc-800/50 px-3 py-2">
        <div className="mb-0.5 flex items-center gap-2">
          <span className="truncate text-xs font-medium text-zinc-200">
            {message.autor?.full_name ?? 'Unbekannt'}
          </span>
          <span className="text-[10px] text-zinc-500">
            {formatRelativeDateTime(message.created_at)}
          </span>
          {isOwn && (
            <button
              type="button"
              onClick={onDelete}
              className="ml-auto text-zinc-500 hover:text-red-400"
              title="Eigene Nachricht löschen"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
        <p className="whitespace-pre-wrap text-sm text-zinc-200">
          {renderWithMentions(message.text)}
        </p>
      </div>
    </div>
  );
}

function renderWithMentions(text: string): React.ReactNode[] {
  // Mention-Erwähnungen hellgrün markieren
  const out: React.ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(MENTION_REGEX)) {
    const start = match.index ?? 0;
    if (start > lastIndex) out.push(text.slice(lastIndex, start));
    out.push(
      <span
        key={start}
        className="rounded bg-emerald-500/15 px-1 font-medium text-emerald-300"
      >
        @{match[1]}
      </span>,
    );
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}
