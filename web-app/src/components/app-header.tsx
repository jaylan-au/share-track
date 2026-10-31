import { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { AppPage } from '../types';
import { onlineFilesEnabled } from '../config';

export interface NavItem {
    label: string;
    onSelect: () => void;
    isCurrent?: boolean;
}

interface AppHeaderProps {
    title: string;
    hasUnsavedChanges: boolean;
    actions?: ComponentChildren;
    navItems: NavItem[];
    onSave?: () => void;
}

const PAGE_LABELS: Record<Exclude<AppPage, 'price-records'>, string> = {
    library: 'Online Portfolio List',
    portfolio: 'Portfolio',
    admin: 'Admin',
    'share-lots': 'Share lots',
    dividends: 'Dividends',
    'activity-report': 'Activity report',
};

export function getPageNavItems(onNavigate: (page: AppPage) => void, currentPage?: AppPage): NavItem[] {
    return (Object.keys(PAGE_LABELS) as Array<Exclude<AppPage, 'price-records'>>)
        .filter((page) => onlineFilesEnabled || page !== 'library')
        .map((page) => ({
            label: PAGE_LABELS[page],
            onSelect: () => onNavigate(page),
            isCurrent: page === currentPage,
        }));
}

export function AppHeader({ title, hasUnsavedChanges, actions, navItems, onSave }: AppHeaderProps): ComponentChildren {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        if (!isMenuOpen) {
            return undefined;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isMenuOpen]);

    const closeMenu = () => setIsMenuOpen(false);

    return (
        <>
            <header class="app-header">
                <div class="app-header-title">
                    <p class="eyebrow">ShareTrack</p>
                    <h1>{title}</h1>
                    {hasUnsavedChanges ? (
                        <span class="unsaved-changes">
                            Unsaved changes
                            {onSave ? (
                                <button
                                    type="button"
                                    class="unsaved-save-button"
                                    aria-label="Save portfolio"
                                    title="Save portfolio"
                                    onClick={onSave}
                                >
                                    Save
                                </button>
                            ) : null}
                        </span>
                    ) : null}
                </div>
                <div class="header-actions">
                    {actions}
                    <button
                        type="button"
                        class="icon-button menu-toggle"
                        aria-label="Open menu"
                        aria-expanded={isMenuOpen}
                        aria-controls="app-drawer"
                        onClick={() => setIsMenuOpen(true)}
                    >
                        <span class="hamburger-icon" aria-hidden="true">
                            <span></span>
                            <span></span>
                            <span></span>
                        </span>
                    </button>
                </div>
            </header>

            {isMenuOpen ? (
                <div class="drawer-backdrop" onClick={closeMenu}>
                    <nav id="app-drawer" class="app-drawer" aria-label="Main menu" onClick={(event) => event.stopPropagation()}>
                        <div class="app-drawer-header">
                            <span class="app-drawer-title">Menu</span>
                            <button type="button" class="icon-button" aria-label="Close menu" onClick={closeMenu}>×</button>
                        </div>
                        <ul class="app-drawer-list">
                            {navItems.map((item) => (
                                <li key={item.label}>
                                    <button
                                        type="button"
                                        class={`drawer-item${item.isCurrent ? ' drawer-item-current' : ''}`}
                                        aria-current={item.isCurrent ? 'page' : undefined}
                                        onClick={() => {
                                            closeMenu();
                                            item.onSelect();
                                        }}
                                    >
                                        {item.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>
            ) : null}
        </>
    );
}
