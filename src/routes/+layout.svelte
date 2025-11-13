<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte'; // [ 1. onMount 임포트 ]
	import { auth, db, messaging } from '$lib/firebase'; // [ 2. messaging, db 임포트 ]
	import { onAuthStateChanged } from 'firebase/auth'; // [ 3. onAuthStateChanged 임포트 ]
	import { doc, updateDoc, arrayUnion } from 'firebase/firestore'; // [ 4. firestore 함수 임포트 ]
	import { getToken, onMessage } from 'firebase/messaging'; // [ 5. messaging 함수 임포트 ]

	let { children } = $props();

	// VAPID 키 (환경 변수에서 가져옴)
	// (주의: .env 파일에 VITE_FIREBASE_VAPID_KEY="YOUR_KEY_HERE" 추가 필요)
	const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

	let showNav = $derived(
		$page.route.id === '/' ||
			$page.route.id === '/likes' ||
			$page.route.id?.startsWith('/matches')
	);

	// [ 6. 신규 ] 푸시 알림 설정 로직
	onMount(() => {
		// 인증 상태가 변경될 때마다 토큰 등록 시도
		const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
			if (user) {
				// 로그인은 되었지만, 브라우저가 알림을 지원하는지 확인
				if ('Notification' in window && vapidKey) {
					setupPushNotifications(user.uid);
				}
			}
			// (로그아웃 시 토큰 삭제 로직은 복잡하므로 여기서는 생략)
		});

		// [ 7. 신규 ] 포그라운드 메시지 수신 (앱이 열려있을 때)
		// (현재는 콘솔에만 기록)
		onMessage(messaging, (payload) => {
			console.log('[Push] Message received in foreground: ', payload);
			// (향후 이곳에 커스텀 토스트/알림 UI를 띄울 수 있음)
		});

		return () => {
			unsubscribeAuth();
		};
	});

	async function setupPushNotifications(uid) {
		try {
			// 1. 알림 권한 요청
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				console.log('알림 권한이 거부되었습니다.');
				return;
			}

			// 2. FCM 토큰 가져오기
			const currentToken = await getToken(messaging, {
				vapidKey: vapidKey
			});

			if (currentToken) {
				// 3. Firestore 'members' 문서에 토큰 저장
				console.log('[Push] FCM Token:', currentToken);
				const userDocRef = doc(db, 'members', uid);
				// arrayUnion: 이미 토큰이 존재하면 추가하지 않음
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