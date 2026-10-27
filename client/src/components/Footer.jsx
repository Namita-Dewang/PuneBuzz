import { Link } from 'react-router';
import { GITHUB_URL } from '../utils/constants';
import { LogoMark, Wordmark } from './Logo';

// lucide-react no longer ships brand logos, so the GitHub mark is inline.
function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto flex max-w-page flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Link to="/" aria-label="Pune Buzz home" className="flex w-fit items-center gap-2 rounded-lg">
            <LogoMark className="size-6" />
            <Wordmark className="text-base" />
          </Link>
          <p className="font-display text-[15px] italic text-ink-muted">The city's evenings, gathered in one place.</p>
        </div>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors duration-150 hover:border-line-strong hover:text-ink"
        >
          <GitHubMark /> GitHub
        </a>
      </div>
    </footer>
  );
}
