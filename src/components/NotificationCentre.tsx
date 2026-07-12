import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, Trash2 } from 'lucide-react';
import { supabase } from '../lib/db';
import { useApp } from '../context/AppContext';
import { localDb } from '../lib/localdb';
import { getStorageMode } from '../lib/storageMode';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  created_at: string;
}

export const NotificationCentre: React.FC = () => {
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotifications();
  }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const loadNotifications = async () => {
    const isLocal = getStorageMode() === 'local';
    let items: Notification[] = [];

    if (isLocal) {
      const raw = localStorage.getItem('finfree_notifications');
      items = raw ? JSON.parse(raw) : [];
    } else if (user && supabase) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await supabase.from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo)
        .order('created_at', { ascending: false })
        .limit(50);
      items = data || [];
    }

    setNotifications(items);
    setUnreadCount(items.filter(n => !n.read).length);
  };

  const markRead = async (id: string) => {
    const isLocal = getStorageMode() === 'local';
    if (isLocal) {
      const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
      localStorage.setItem('finfree_notifications', JSON.stringify(updated));
      setNotifications(updated);
    } else if (supabase) {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const clearAll = async () => {
    const isLocal = getStorageMode() === 'local';
    if (isLocal) {
      const updated = notifications.map(n => ({ ...n, read: true }));
      localStorage.setItem('finfree_notifications', JSON.stringify(updated));
      setNotifications(updated);
    } else if (supabase && user) {
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
    setUnreadCount(0);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) loadNotifications(); }}
        className="relative p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-[999]">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={clearAll} className="text-xs text-primary hover:underline cursor-pointer">
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-80">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No notifications yet</p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`p-3 border-b border-border/50 cursor-pointer hover:bg-accent/50 transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${!n.read ? 'font-medium' : 'text-muted-foreground'}`}>{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(n.created_at)}</span>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-primary absolute right-3 top-3" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
