import BackupForm from './components/BackupForm';

export default function Page() {
  return (
    <>
      <header>
        <span className="dot" aria-hidden="true" />
        <h1>Vercel Blob → Zip</h1>
      </header>

      <main>
        <BackupForm />
      </main>

      <footer>
        <span>Streams directly to your device</span>
        <span>
          <code>GET /api/backup</code>
        </span>
      </footer>
    </>
  );
}
