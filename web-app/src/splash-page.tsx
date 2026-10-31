import { useState } from 'preact/hooks';
import { AuthStatus } from './types';

interface SplashPageProps {
    authStatus: AuthStatus;
    onSignIn: () => void;
    onCheckSignIn: () => void;
    onContinueOffline: () => void;
}

export function SplashPage({ authStatus, onSignIn, onCheckSignIn, onContinueOffline }: SplashPageProps) {
    const [isSignInStarted, setIsSignInStarted] = useState(false);
    const isChecking = authStatus === 'checking';

    const startSignIn = () => {
        setIsSignInStarted(true);
        onSignIn();
    };

    return (
        <main class="splash-page">
            <section class="splash-card">
                <p class="eyebrow">ShareTrack</p>
                <h1>Track your share portfolio</h1>
                <p class="splash-intro">Sign in to open and save portfolios online, or work offline with JSON files on this device.</p>

                {isChecking ? (
                    <p class="splash-status" role="status">Checking your sign-in…</p>
                ) : (
                    <div class="splash-options">
                        <div class="splash-option">
                            <h2>Online portfolios</h2>
                            <p>Save portfolios to your account and open them from any device.</p>
                            <button class="primary-button" type="button" onClick={startSignIn}>
                                Sign in for online portfolios
                            </button>
                            {isSignInStarted ? (
                                <>
                                    <p class="splash-hint">A sign-in page has opened in a new tab. Once you have signed in, come back here.</p>
                                    <button class="secondary-button" type="button" onClick={onCheckSignIn}>
                                        I've signed in
                                    </button>
                                </>
                            ) : null}
                        </div>
                        <div class="splash-option">
                            <h2>Local files</h2>
                            <p>Work without signing in. Upload and download JSON files yourself.</p>
                            <button class="secondary-button" type="button" onClick={onContinueOffline}>
                                Continue without signing in
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}
