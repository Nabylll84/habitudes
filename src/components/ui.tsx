import React from 'react';
import type { Profile } from '@/lib/types';

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div className="logo-mark" style={{ width: size, height: size, fontSize: size * 0.5 }}>
      ⚡
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 6, label }: { value: number; size?: number; stroke?: number; label?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring-val"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <div className="ring-label">{label ?? <strong>{Math.round(pct * 100)}%</strong>}</div>
    </div>
  );
}

export function Avatar({ profile, size = 40 }: { profile: Pick<Profile, 'username' | 'avatar_url'>; size?: number }) {
  if (profile.avatar_url) {
    return (
      <img
        className="avatar avatar-img"
        src={profile.avatar_url}
        alt={profile.username}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className="avatar avatar-letter" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {profile.username.charAt(0).toUpperCase()}
    </div>
  );
}

export function SparkIcon() {
  return <span aria-hidden>✨</span>;
}

export function Skeleton({ w = '100%', h = 18 }: { w?: number | string; h?: number }) {
  return <div className="skel" style={{ width: w, height: h }} />;
}

export function EmptyState({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="empty">
      <div className="empty-emoji">{emoji}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}