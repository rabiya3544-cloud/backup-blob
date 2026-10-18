'use client';

import { useState } from 'react';

export default function BackupForm() {
  const [prefix, setPrefix] = useState('production/');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setStatus('Preparing download… large backups may take a while.');
    setBusy(true);

    const url =
      '/api/backup?prefix=' + encodeURIComponent(prefix) +
      '&key=' + encodeURIComponent(password);

    // Native streamed download — the browser writes straight to disk
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => {
      setBusy(false);
      setStatus('Download started.');
    }, 1500);
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="prefix">Prefix</label>
          <input
            id="prefix"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>

        <div>
          <label htmlFor="key">
            Password{' '}
            <span style={{ fontWeight: 400, textTransform: 'none' }}>
              (if required)
            </span>
          </label>
          <input
            id="key"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <button type="submit" disabled={busy}>
          Download backup (.zip)
        </button>
      </form>

      <p id="status" role="status" aria-live="polite">
        {status}
      </p>
    </>
  );
}
