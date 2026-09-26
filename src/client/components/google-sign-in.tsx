type GoogleAuthIntent = "login" | "play" | "post_game" | "delete";

export function GoogleMark() {
  return (
    <span className="google-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path
          fill="#4285f4"
          d="M21.6 12.23c0-.71-.06-1.23-.2-1.78H12v3.4h5.52a4.78 4.78 0 0 1-2.05 3.05l-.02.11 2.98 2.31.2.02c1.84-1.7 2.97-4.2 2.97-7.11Z"
        />
        <path
          fill="#34a853"
          d="M12 22c2.7 0 4.96-.89 6.62-2.42l-3.16-2.44c-.85.57-1.98.97-3.46.97a6 6 0 0 1-5.67-4.15l-.1.01-3.1 2.4-.04.1A10 10 0 0 0 12 22Z"
        />
        <path
          fill="#fbbc05"
          d="M6.33 13.96A6.16 6.16 0 0 1 6 12c0-.68.12-1.34.32-1.96v-.12L3.18 7.48l-.1.05A10 10 0 0 0 2 12c0 1.61.39 3.13 1.09 4.47l3.24-2.51Z"
        />
        <path
          fill="#ea4335"
          d="M12 5.89c1.88 0 3.15.81 3.88 1.48l2.8-2.73A9.5 9.5 0 0 0 12 2a10 10 0 0 0-8.91 5.53l3.23 2.51A6.02 6.02 0 0 1 12 5.89Z"
        />
      </svg>
    </span>
  );
}

export function GoogleSignInLink({ intent }: { intent: GoogleAuthIntent }) {
  return (
    <a className="button google-auth-button" href={`/api/v1/auth/google/start?intent=${intent}`}>
      <GoogleMark />
      Continue with Google
    </a>
  );
}
