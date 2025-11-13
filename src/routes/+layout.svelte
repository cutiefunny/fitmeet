<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	// [ 1. 수정 ] auth, db, firestore 함수 임포트 제거
	import { messaging } from '$lib/firebase';
	// [ 2. 수정 ] getToken 등 제거, onMessage만 남김
	import { onMessage } from 'firebase/messaging';

	let { children } = $props();

	const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

	let showNav = $derived(
		$page.route.id === '/' ||
			$page.route.id === '/likes' ||
			$page.route.id?.startsWith('/matches')
	);

	// [ 3. 수정 ] onMount에서 토큰 등록/권한 요청 로직 모두 제거
	onMount(() => {
		// 'messaging'이 브라우저에서 초기화되었는지 확인
		if (messaging && vapidKey) {
			
			// 앱이 켜져있을 때(포그라운드) 메시지를 수신하는 리스너만 남겨둠
			onMessage(messaging, (payload) => {
				console.log('[Push] Message received in foreground: ', payload);
				// (향후 이곳에 커스텀 토스트/알림 UI를 띄울 수 있음)
			});
		} else if (!messaging) {
			console.log('FCM in SSR mode. Skipping listeners.');
		} else if (!vapidKey) {
			console.warn('VITE_FIREBASE_VAPID_KEY가 .env 파일에 설정되지 않았습니다. 푸시 알림이 비활성화됩니다.');
		}
	});

	// [ 4. 수정 ] setupPushNotifications 함수 제거
</script>

<svelte:head>
	<link rel="icon" href="/icon-192.png" />
</svelte:head>

{@render children()}

{#if showNav}
	<nav class="bottom-nav">
		<a href="/likes" class="nav-item" class:active={$page.route.id === '/likes'}>
			<span class="icon">❤️</span>
			<span class="label">Likes</span>
		</a>
		<a href="/" class="nav-item main" class:active={$page.route.id === '/'}>
			<span class="icon">🔥</span>
			<span class="label">Home</span>
		</a>
		<a
			href="/matches"
			class="nav-item"
			class:active={$page.route.id?.startsWith('/matches')}
		>
			<span class="icon">💬</span>
			<span class="label">Matches</span>
		</a>
	</nav>
{/if}

<style>
	/* ... (스타일은 이전과 동일) ... */
	:global(body) {
		margin: 0;
		padding: 0;
	}
	.bottom-nav {
		display: flex;
		justify-content: space-around;
		align-items: center;
		height: 60px;
		background-color: #ffffff;
		border-top: 1px solid #eee;
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		max-width: 500px;
		margin: 0 auto;
		box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
		z-index: 50;
	}
	.nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		color: #aaa;
		font-size: 10px;
		font-weight: 500;
		padding: 4px;
		width: 70px;
		transition: color 0.2s;
	}
	.nav-item .icon {
		font-size: 24px;
	}
	.nav-item .label {
		margin-top: 2px;
	}
	.nav-item.main .icon {
		font-size: 28px;
	}
	.nav-item.active {
		color: #ff6b6b;
		font-weight: bold;
	}
</style>