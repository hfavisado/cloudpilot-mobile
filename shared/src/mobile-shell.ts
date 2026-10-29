import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';

const EMULATION = '#/tab/emulation';
const PAUSE_ROUTE = '#/tab/sessions';
const EDGE_PX = 24;
const SWIPE_PX = 60;

const MENU: ReadonlyArray<readonly [string, string]> = [
    ['Load device image', '#/tab/sessions'],
    ['Memory cards', '#/tab/storage'],
    ['Settings', '#/tab/settings'],
    ['About', '#/tab/about'],
];

let menu: HTMLElement;
let backButton: HTMLElement;
let menuOpen = false;
// Leaving the emulation page is what pauses and saves the session upstream.
let resumeOnActive = false;

const onEmulation = () => location.hash === EMULATION;

function go(route: string): void {
    location.hash = route;
}

function syncRouteState(): void {
    const emulation = onEmulation();
    document.body.classList.toggle('cpm-emulation', emulation);
    backButton.style.display = emulation || menuOpen ? 'none' : 'block';
}

function openMenu(): void {
    if (menuOpen) return;

    menuOpen = true;
    if (onEmulation()) go(PAUSE_ROUTE);
    menu.style.display = 'flex';
    syncRouteState();
}

function closeMenu(route = EMULATION): void {
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

    const resume = document.createElement('button');
    resume.textContent = 'Back to emulator';
    resume.addEventListener('click', () => closeMenu());
    panel.append(resume);

    for (const [label, route] of MENU) {
        const item = document.createElement('button');
        item.textContent = label;
        item.addEventListener('click', () => closeMenu(route));
        panel.append(item);
    }

    menu.append(panel);

    backButton = document.createElement('button');
    backButton.id = 'cpm-back';
    backButton.textContent = 'Emulator';
    backButton.addEventListener('click', () => go(EMULATION));

    document.body.append(menu, backButton);
}

function installSwipe(): void {
    let startY: number | undefined;

    window.addEventListener(
        'touchstart',
        (e) => {
            const t = e.touches[0];
            startY = e.touches.length === 1 && t.clientY <= EDGE_PX && !menuOpen ? t.clientY : undefined;
            if (startY !== undefined) e.stopPropagation();
        },
        { capture: true, passive: true },
    );

    window.addEventListener(
        'touchmove',
        (e) => {
            if (startY === undefined) return;

            e.stopPropagation();
            if (e.touches[0].clientY - startY >= SWIPE_PX) {
                startY = undefined;
                openMenu();
            }
        },
        { capture: true, passive: true },
    );
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
    new MutationObserver(fitCanvas).observe(document.body, {
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
});
