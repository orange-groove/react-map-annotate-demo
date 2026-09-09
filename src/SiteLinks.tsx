const LINKS = [
  {
    id: "site",
    href: "https://orange-groove-solutions.com",
    label: "Orange Groove Solutions",
  },
  {
    id: "github",
    href: "https://github.com/orange-groove/react-map-annotate",
    label: "GitHub repository",
  },
  {
    id: "npm",
    href: "https://www.npmjs.com/package/@orange-groove/react-map-annotate",
    label: "npm package",
  },
] as const;

export function SiteLinks() {
  return (
    <nav className="site-links" aria-label="Project links">
      {LINKS.map((link) => (
        <a
          key={link.id}
          className="site-link"
          href={link.href}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={link.label}
          title={link.label}
        >
          {link.id === "site" ? (
            <img
              className="site-link-logo"
              src="/orange-groove.png"
              alt=""
              width={22}
              height={22}
            />
          ) : link.id === "github" ? (
            <GithubIcon />
          ) : (
            <NpmIcon />
          )}
        </a>
      ))}
    </nav>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0c4.42 0 8 3.58 8 8a8.01 8.01 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27s-1.36.09-2 .27c-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.27-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.46-.55.38A8 8 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}

function NpmIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0v1.336H8.001V8.667h5.334v5.332h-2.669v-.001zm12.001 0h-1.33v-4h-1.336v4h-1.335v-4h-1.33v4h-2.671V8.667h8.002v5.331zM10.665 10H12v2.667h-1.335V10z" />
    </svg>
  );
}
