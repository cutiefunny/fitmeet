/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

// [ 1. 신규 ] Firebase SDK 임포트 (CDN)
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

// --- [ 2. 신규 ] Firebase 구성 ---
// ⚠️ 중요: 이 객체에 .env 파일의 VITE_FIREBASE_... 값들을
//    '직접 복사/붙여넣기' 해야 합니다.
const firebaseConfig = {
	apiKey: 'YOUR_VITE_FIREBASE_API_KEY',
	authDomain: 'YOUR_VITE_FIREBASE_AUTH_DOMAIN',
	projectId: 'YOUR_VITE_FIREBASE_PROJECT_ID',
	storageBucket: 'YOUR_VITE_FIREBASE_STORAGE_BUCKET',
	messagingSenderId: 'YOUR_VITE_FIREBASE_MESSAGING_SENDER_ID',
	appId: 'YOUR_VITE_FIREBASE_APP_ID'
};

// [ 3. 신규 ] Firebase 앱 및 메시징 초기화
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// [ 4. ⭐️⭐️⭐️ 수정 ⭐️⭐️⭐️ ] 백그라운드 메시지 핸들러
onBackgroundMessage(messaging, (payload) => {
	console.log('[SW] Received background message (data-only)', payload);

	// [ 수정 ] 'payload.notification' 대신 'payload.data'에서 읽기
	const notificationTitle = payload.data.title || '새 메시지';
	const notificationOptions = {
		body: payload.data.body || '메시지를 확인하세요.',
		icon: payload.data.icon || '/icon-192.png',
		data: {
			url: payload.data.url || '/'
		}
	};

	// (기존) 알림 표시
	self.registration.showNotification(notificationTitle, notificationOptions);
});

// [ 5. 신규 ] 알림 클릭 이벤트 핸들러
self.addEventListener('notificationclick', (event) => {
	event.notification.close(); // 알림 닫기

	const urlToOpen = event.notification.data.url || '/';

	// 클릭 시 해당 URL의 창을 열거나 포커스
	event.waitUntil(
		clients.matchAll({ type: 'window' }).then((clientList) => {
			for (const client of clientList) {
				if (client.url === urlToOpen && 'focus' in client) {
					return client.focus();
				}
			}
			if (clients.openWindow) {
				return clients.openWindow(urlToOpen);
			}
		})
	);
});

// --- (기존 SvelteKit PWA 로직) ---

const CACHE = `cache-${version}`;
const ASSETS = [
	...build, // SvelteKit이 빌드한 JS/CSS 파일들
	...files // static 폴더에 있는 파일들
];

// ... (install, activate, fetch 이벤트 리스너는 기존과 동일) ...

// 1. 설치 (install)
self.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}
	event.waitUntil(addFilesToCache());
});

// 2. 활성화 (activate)
self.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}
	event.waitUntil(deleteOldCaches());
});

// 3. 요청 가로채기 (fetch)
self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	async function respond() {
		const url = new URL(event.request.url);
		const cache = await caches.open(CACHE);

		if (ASSETS.includes(url.pathname)) {
			const response = await cache.match(url.pathname);
			if (response) return response;
		}

		try {
			const response = await fetch(event.request);
			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}
			return response;
		} catch {
			const cachedResponse = await cache.match(event.request);
			if (cachedResponse) return cachedResponse;
			throw new Error('Offline and no cache available');
		}
	}
	event.respondWith(respond());
});