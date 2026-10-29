import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';

const EMULATION = '#/tab/emulation';
const PAUSE_ROUTE = '#/tab/sessions';
const EDGE_PX = 24;
const SWIPE_PX = 60;
const CROSS_AXIS_PX = 40;

const MENU: ReadonlyArray<readonly [string, string]> = [
    ['Load device image', '#/tab/sessions'],
    ['Memory cards', '#/tab/storage'],
    ['Settings', '#/tab/settings'],
    ['About', '#/tab/about'],
];

let menu: HTMLElement;
let backButtons: HTMLElement;
let menuReturnButton: HTMLButtonElement;
let menuOpen = false;
let menuReturnRoute = EMULATION;
// Leaving the emulation page is what pauses and saves the session upstream.
let resumeOnActive = false;

const onEmulation = () => location.hash === EMULATION;
const onSessions = () => location.hash === PAUSE_ROUTE;

function go(route: string): void {
    location.hash = route;
}

function syncRouteState(): void {
    const emulation = onEmulation();
    document.body.classList.toggle('cpm-emulation', emulation);

    const toolbar = document.querySelector('ion-header:not([collapse]) ion-toolbar');
    if (toolbar && backButtons.parentElement !== toolbar) toolbar.prepend(backButtons);

    const display = emulation || onSessions() || menuOpen ? 'none' : 'flex';
    if (backButtons.style.display !== display) backButtons.style.display = display;
}

function openMenu(): void {
    if (menuOpen) return;

    menuReturnRoute = location.hash || EMULATION;
    menuReturnButton.textContent = menuReturnRoute === EMULATION ? 'Back to emulator' : menuReturnRoute === PAUSE_ROUTE ? 'Sessions' : 'Back';
    menuOpen = true;
    if (onEmulation()) go(PAUSE_ROUTE);
    menu.style.display = 'flex';
    syncRouteState();
}

function closeMenu(route = menuReturnRoute): void {
    menuOpen = false;
    menu.style.display = 'none';
    go(route);
    syncRouteState();
}

function buildUi(): void {
    menu = document.createElement('div');
    menu.id = 'cpm-menu';
    menu.style.display = 'none';
    menu.addEventListener('click', (e) => e.target === menu && closeMenu());

    const panel = document.createElement('div');
    panel.className = 'cpm-panel';

    menuReturnButton = document.createElement('button');
    menuReturnButton.addEventListener('click', () => closeMenu());
    panel.append(menuReturnButton);

    for (const [label, route] of MENU) {
        const item = document.createElement('button');
        item.textContent = label;
        item.addEventListener('click', () => closeMenu(route));
        panel.append(item);
    }

    menu.append(panel);

    backButtons = document.createElement('ion-buttons');
    backButtons.id = 'cpm-back';
    backButtons.slot = 'start';
    const backButton = document.createElement('ion-button');
    backButton.textContent = 'Sessions';
    backButton.setAttribute('aria-label', 'Back to sessions');
    backButton.addEventListener('click', () => go(PAUSE_ROUTE));
    backButtons.append(backButton);

    document.body.append(menu);
}

function installSwipe(): void {
    let startX: number | undefined;
    let startY: number | undefined;

    window.addEventListener(
        'touchstart',
        (e) => {
            if (e.touches.length !== 1) {
                startX = undefined;
                startY = undefined;
                return;
            }

            const t = e.touches[0];
            startX = t.clientX <= EDGE_PX ? t.clientX : undefined;
            startY = t.clientY <= EDGE_PX || menuOpen ? t.clientY : undefined;
            if (startX !== undefined || startY !== undefined) e.stopPropagation();
        },
        { capture: true, passive: true },
    );

    window.addEventListener(
        'touchmove',
        (e) => {
            if (e.touches.length !== 1) {
                startX = undefined;
                startY = undefined;
                return;
            }

            const t = e.touches[0];
            const dx = startX === undefined ? 0 : t.clientX - startX;
            const dy = startY === undefined ? 0 : t.clientY - startY;

            if (menuOpen && startY !== undefined && dy <= -SWIPE_PX && Math.abs(dx) < CROSS_AXIS_PX) {
                startX = undefined;
                startY = undefined;
                e.stopPropagation();
                e.preventDefault();
                closeMenu();
            } else if (!menuOpen && startY !== undefined && dy >= SWIPE_PX && Math.abs(dx) < CROSS_AXIS_PX) {
                startX = undefined;
                startY = undefined;
                e.stopPropagation();
                e.preventDefault();
                openMenu();
            } else if (!menuOpen && startX !== undefined && dx >= SWIPE_PX && Math.abs(dy) < CROSS_AXIS_PX && !onSessions()) {
                startX = undefined;
                startY = undefined;
                e.stopPropagation();
                e.preventDefault();
                go(PAUSE_ROUTE);
            } else if (startX !== undefined || startY !== undefined) {
                e.stopPropagation();
            }
        },
        { capture: true, passive: false },
    );

    const reset = () => {
        startX = undefined;
        startY = undefined;
    };
    window.addEventListener('touchend', reset, { capture: true, passive: true });
    window.addEventListener('touchcancel', reset, { capture: true, passive: true });
}

function fitCanvas(): void {
    const canvas = document.querySelector<HTMLCanvasElement>('.running-session canvas');
    if (!canvas || !canvas.width || !canvas.height || !onEmulation()) return;

    const scale = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height);
    const w = `${canvas.width * scale}px`;
    const h = `${canvas.height * scale}px`;

    if (canvas.style.width !== w) canvas.style.setProperty('width', w, 'important');
    if (canvas.style.height !== h) canvas.style.setProperty('height', h, 'important');
}

function installFit(): void {
    window.addEventListener('resize', fitCanvas);
    window.addEventListener('hashchange', fitCanvas);
    new MutationObserver(() => {
        fitCanvas();
        syncRouteState();
    }).observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['style', 'width', 'height'],
    });
}

function installLifecycle(): void {
    void App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive && onEmulation()) {
            resumeOnActive = true;
            go(PAUSE_ROUTE);
        } else if (isActive && resumeOnActive && !menuOpen) {
            resumeOnActive = false;
            go(EMULATION);
        }
    });
}

function installBackNavigation(): void {
    if (Capacitor.getPlatform() !== 'android') return;

    void App.addListener('backButton', () => {
        if (menuOpen) {
            closeMenu();
        } else if (!onSessions()) {
            go(PAUSE_ROUTE);
        } else {
            void App.exitApp();
        }
    });
}

if (!location.hash) location.hash = EMULATION;

window.addEventListener('DOMContentLoaded', () => {
    buildUi();
    installSwipe();
    installFit();
    window.addEventListener('hashchange', syncRouteState);
    syncRouteState();

    if (Capacitor.isNativePlatform()) {
        installLifecycle();
        void StatusBar.hide();
    }
    installBackNavigation();
});
