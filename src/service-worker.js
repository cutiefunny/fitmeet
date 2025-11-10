/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

// 캐시 이름 생성 (버전이 바뀌면 새로운 캐시 생성)
const CACHE = `cache-${version}`;

// 캐시할 자산 목록 (빌드된 파일 + static 폴더의 파일)
const ASSETS = [
	...build, // SvelteKit이 빌드한 JS/CSS 파일들
	...files  // static 폴더에 있는 파일들
];

// 1. 설치 (install): 필요한 파일들을 미리 캐싱합니다.
self.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
});

// 2. 활성화 (activate): 이전 버전의 캐시를 정리합니다.
self.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

// 3. 요청 가로채기 (fetch): 네트워크 요청을 가로채서 캐시된 내용을 반환하거나 네트워크로 요청합니다.
self.addEventListener('fetch', (event) => {
	// GET 요청만 캐싱 처리
	if (event.request.method !== 'GET') return;

	async function respond() {
		const url = new URL(event.request.url);
		const cache = await caches.open(CACHE);

		// 1) 빌드 자산이나 static 파일 요청인 경우 캐시에서 바로 반환
		if (ASSETS.includes(url.pathname)) {
			const response = await cache.match(url.pathname);
			if (response) return response;
		}

		// 2) 그 외 요청(페이지 등)은 네트워크 우선 시도 후 실패 시 캐시 사용
		try {
			const response = await fetch(event.request);
			// 정상 응답이면 캐시 업데이트 (오프라인 대비)
			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}
			return response;
		} catch {
			// 네트워크 실패 시 캐시된 데이터 반환 시도
			const cachedResponse = await cache.match(event.request);
			if (cachedResponse) return cachedResponse;
            
            // 캐시도 없으면 오프라인 페이지 등을 반환할 수 있음 (여기서는 생략)
			throw new Error('Offline and no cache available');
		}
	}

	event.respondWith(respond());
});