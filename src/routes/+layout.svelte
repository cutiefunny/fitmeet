<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { auth, db, messaging } from '$lib/firebase';
	import { onAuthStateChanged } from 'firebase/auth';
	import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
	import { getToken, onMessage } from 'firebase/messaging';

	let { children } = $props();

	// (주의: .env 파일에 VITE_FIREBASE_VAPID_KEY="YOUR_KEY_HERE" 추가 필요)
	const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

	let showNav = $derived(
		$page.route.id === '/' ||
			$page.route.id === '/likes' ||
			$page.route.id?.startsWith('/matches')
	);

	onMount(() => {
		if (messaging && vapidKey) {
			const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
				if (user) {
					if ('Notification' in window) {
						setupPushNotifications(user.uid);
					}
				}
			});

			onMessage(messaging, (payload) => {
				console.log('[Push] Message received in foreground: ', payload);
			});

			return () => {
				unsubscribeAuth();
			};
		} else if (!vapidKey) {
			console.warn('VITE_FIREBASE_VAPID_KEY가 .env 파일에 설정되지 않았습니다. 푸시 알림이 비활성화됩니다.');
		}
	});

	// [ 1. 'setupPushNotifications' 함수 수정 ]
	async function setupPushNotifications(uid) {
		if (!messaging) return;

		try {
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				console.log('알림 권한이 거부되었습니다.');
				return;
			}

			// (신규) SvelteKit이 등록한 서비스 워커('src/service-worker.js')를 가져옵니다.
			const swRegistration = await navigator.serviceWorker.ready;

			// (수정) getToken에 serviceWorkerRegistration을 전달합니다.
			// 이렇게 하면 FCM은 /firebase-messaging-sw.js를 찾지 않습니다.
			const currentToken = await getToken(messaging, {
				vapidKey: vapidKey,
				serviceWorkerRegistration: swRegistration
			});

			if (currentToken) {
				console.log('[Push] FCM Token:', currentToken);
				const userDocRef = doc(db, 'members', uid);
				await updateDoc(userDocRef, {
					fcmTokens: arrayUnion(currentToken)
				});
			} else {
				console.log('FCM 토큰을 발급받지 못했습니다.');
			}
		} catch (err) {
			console.error('푸시 알림 설정 중 오류 발생:', err);
		}
	}
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