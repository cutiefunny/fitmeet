<script>
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { db, auth } from '$lib/firebase';
	import { onAuthStateChanged } from 'firebase/auth';
	import {
		collection,
		query,
		orderBy,
		onSnapshot,
		addDoc,
		serverTimestamp,
		doc,
		getDoc,
		setDoc
	} from 'firebase/firestore';
	import { tick } from 'svelte';
	import AlertModal from '$lib/components/AlertModal.svelte';

	let currentUser = null;
	let targetUser = null;
	let targetUserId = $page.params.matchId;
	let chatRoomId = null;
	let messagesColRef = null;

	let messages = [];
	let newMessage = '';
	let isLoading = true;
	let unsubscribeAuth;
	let unsubscribeMessages;

	let messageListEl;
	let showCustomAlert = false;
	let customAlertMessage = '';

	// [ 1. 신규 ] 필터링 목록
	let bannedWords = [];
	let bannedWordRegex = null; // 동적으로 생성될 정규식

	// (기존) 하드코딩된 정규식
	const phoneRegex = /(010|02|0\d{1,2})[ \-.]?\d{3,4}[ \-.]?\d{4}/;
	const emailRegex = /[\w-\.]+@([\w-]+\.)+[\w-]{2,4}/;
	const instaRegex = /(instagram\.com\/[a-zA-Z0-9_.]+|@[a-zA-Z0-9_.]+)/i;
	
	// (신규) 정규식 특수 문자 이스케이프 헬퍼
	function escapeRegExp(string) {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	async function scrollToBottom() {
		await tick();
		if (messageListEl) {
			messageListEl.scrollTop = messageListEl.scrollHeight;
		}
	}

	async function markAsRead(uid, cId) {
		// ... (이전과 동일)
		if (!uid || !cId) return;
		const chatRoomDocRef = doc(db, 'chats', cId);
		try {
			await setDoc(
				chatRoomDocRef,
				{
					readBy: {
						[uid]: true
					}
				},
				{ merge: true }
			);
		} catch (e) {
			console.error('읽음 처리 실패:', e);
		}
	}

	// [ 2. 신규 ] 필터링 목록 로드 함수
	async function fetchFilterList() {
		try {
			const filteringDocRef = doc(db, 'config', 'filtering');
			const filteringSnap = await getDoc(filteringDocRef);
			if (filteringSnap.exists()) {
				bannedWords = filteringSnap.data().bannedWords || [];
				if (bannedWords.length > 0) {
					// 동적 정규식 생성
					const bannedWordPattern = bannedWords.map(escapeRegExp).join('|');
					bannedWordRegex = new RegExp(bannedWordPattern, 'giu');
				}
			}
		} catch (e) {
			console.error('필터 목록 로드 실패:', e);
			// (실패해도 채팅은 가능해야 함)
		}
	}

	onMount(() => {
		// [ 3. 수정 ] onMount에서 필터 목록 로드
		fetchFilterList();

		unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
			if (user) {
				currentUser = user;
				const uids = [user.uid, targetUserId].sort();
				chatRoomId = uids.join('_');
				messagesColRef = collection(db, 'chats', chatRoomId, 'messages');

				try {
					const targetDocRef = doc(db, 'members', targetUserId);
					const targetDocSnap = await getDoc(targetDocRef);
					if (targetDocSnap.exists()) {
						targetUser = targetDocSnap.data();
					}
				} catch (e) {
					console.error('상대방 정보 로딩 실패:', e);
				}

				const q = query(messagesColRef, orderBy('timestamp', 'asc'));
				unsubscribeMessages = onSnapshot(
					q,
					(snapshot) => {
						messages = snapshot.docs.map((doc) => ({
							id: doc.id,
							...doc.data()
						}));
						isLoading = false;
						scrollToBottom();
						markAsRead(currentUser.uid, chatRoomId);
					},
					(error) => {
						console.error('메시지 수신 오류:', error);
						isLoading = false;
					}
				);
			} else {
				currentUser = null;
				isLoading = false;
			}
		});

		return () => {
			if (unsubscribeAuth) unsubscribeAuth();
			if (unsubscribeMessages) unsubscribeMessages();
		};
	});

	// [ 4. 'sendMessage' 함수 수정 ]
	async function sendMessage() {
		const text = newMessage.trim();
		if (text === '' || !currentUser || !messagesColRef || !chatRoomId) return;

		// [ 5. 수정 ] 클라이언트 측 개인정보 검증 (동적 목록 포함)
		if (phoneRegex.test(text)) {
			customAlertMessage = '안전한 대화를 위해\n전화번호를 전송할 수 없습니다.';
			showCustomAlert = true;
			return;
		}
		if (emailRegex.test(text)) {
			customAlertMessage = '안전한 대화를 위해\n이메일 주소를 전송할 수 없습니다.';
			showCustomAlert = true;
			return;
		}
		if (instaRegex.test(text)) {
			customAlertMessage = '안전한 대화를 위해\nSNS ID 또는 주소를 전송할 수 없습니다.';
			showCustomAlert = true;
			return;
		}
		// (신규) 동적 필터 목록 검사
		if (bannedWordRegex && bannedWordRegex.test(text)) {
			customAlertMessage = '부적절한 단어가 포함되어\n메시지를 전송할 수 없습니다.';
			showCustomAlert = true;
			return;
		}

		// (검증 통과)
		newMessage = '';
		const newTimestamp = serverTimestamp();

		try {
			// 1. 'messages' 하위 컬렉션에 새 메시지 추가
			await addDoc(messagesColRef, {
				text: text,
				senderId: currentUser.uid,
				timestamp: newTimestamp
				// (isBlocked는 서버에서 처리)
			});

			// 2. 'chats' 상위 문서 업데이트
			const chatRoomDocRef = doc(db, 'chats', chatRoomId);
			const readByStatus = {
				[currentUser.uid]: true,
				[targetUserId]: false
			};
			await setDoc(
				chatRoomDocRef,
				{
					participants: [currentUser.uid, targetUserId],
					lastSenderId: currentUser.uid,
					lastMessage: text, // (서버에서 차단되면 이 값이 덮어써짐)
					lastMessageTimestamp: newTimestamp,
					readBy: readByStatus,
					isBlocked: false // (일단 false로 보내고 서버가 판단)
				},
				{ merge: true }
			);

			scrollToBottom();
		} catch (error) {
			console.error('Error sending message:', error);
			customAlertMessage = '메시지 전송에 실패했습니다.';
			showCustomAlert = true;
			newMessage = text;
		}
	}
</script>

<div class="app-container">
	<header class="app-header">
		<a href="/matches" class="back-link" sveltekit:prefetch>←</a>
		<h1 class="logo">
			{#if targetUser}
				{targetUser.name}
			{:else}
				채팅
			{/if}
		</h1>
		<div class="placeholder" />
	</header>

	<main class="main-content" bind:this={messageListEl}>
		{#if isLoading}
			<div class="empty-state"><p>채팅 내역을 불러오는 중입니다...</p></div>
		{:else if !currentUser}
			<div class="empty-state">
				<p>로그인이 필요합니다.<br />메인 페이지로 돌아가 로그인해주세요.</p>
			</div>
		{:else}
			<div class="message-list">
				{#each messages as message (message.id)}
					<div
						class="message-bubble"
						class:sent={message.senderId === currentUser.uid}
						class:received={message.senderId !== currentUser.uid}
						class:blocked={message.isBlocked}
					>
						{#if message.isBlocked}
							<p class="blocked-message">
								<i>{message.text}</i>
							</p>
						{:else}
							<p>{message.text}</p>
						{/if}

						{#if message.timestamp}
							<span>{message.timestamp.toDate().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</main>

	<form class="chat-form" on:submit|preventDefault={sendMessage}>
		<input
			type="text"
			bind:value={newMessage}
			placeholder="메시지 입력..."
			disabled={!currentUser}
		/>
		<button type="submit" disabled={!currentUser || newMessage.trim() === ''}>전송</button>
	</form>

	{#if showCustomAlert}
		<AlertModal message={customAlertMessage} on:close={() => (showCustomAlert = false)} />
	{/if}
</div>

<style>
	/* ... (기존 스타일 :global(body), .app-container, .app-header 등 동일) ... */
	:global(body) {
		margin: 0;
		padding: 0;
		font-family:
			-apple-system,
			BlinkMacSystemFont,
			'Apple SD Gothic Neo',
			'Malgun Gothic',
			sans-serif;
		background-color: #f5f7fa;
		color: #333;
	}
	.app-container {
		max-width: 500px;
		height: 100dvh;
		margin: 0 auto;
		background-color: #f9f9f9;
		display: flex;
		flex-direction: column;
		box-shadow: 0 0 20px rgba(0, 0, 0, 0.05);
		position: relative;
	}
	.app-header {
		height: 60px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 20px;
		border-bottom: 1px solid #eee;
		background-color: #fff;
		flex-shrink: 0;
	}
	.logo {
		font-size: 20px;
		font-weight: 800;
		color: #333;
		margin: 0;
		letter-spacing: -0.5px;
	}
	.back-link {
		font-size: 24px;
		font-weight: bold;
		color: #333;
		text-decoration: none;
		width: 40px;
	}
	.placeholder {
		width: 40px;
	}
	.main-content {
		flex: 1;
		padding: 16px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}
	.empty-state {
		flex: 1;
		display: flex;
		justify-content: center;
		align-items: center;
		color: #999;
		font-size: 18px;
		text-align: center;
		line-height: 1.6;
	}
	.message-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
		margin-top: auto;
	}
	.message-bubble {
		display: flex;
		flex-direction: column;
		max-width: 75%;
		padding: 10px 14px;
		border-radius: 18px;
		word-break: keep-all;
		white-space: pre-wrap;
	}
	.message-bubble p {
		margin: 0;
		font-size: 16px;
		line-height: 1.5;
	}
	.message-bubble span {
		font-size: 10px;
		margin-top: 4px;
		opacity: 0.7;
		align-self: flex-end;
	}
	.message-bubble.sent {
		align-self: flex-end;
		background-color: #ff6b6b;
		color: white;
		border-bottom-right-radius: 4px;
	}
	.message-bubble.sent span {
		color: #fff;
	}
	.message-bubble.received {
		align-self: flex-start;
		background-color: #fff;
		color: #333;
		border: 1px solid #eee;
		border-bottom-left-radius: 4px;
	}
	.message-bubble.received span {
		color: #888;
	}

	/* [ 7. 수정 ] 차단된 메시지 스타일 */
	.blocked-message {
		color: #888;
		font-size: 14px !important;
	}
	.message-bubble.sent.blocked .blocked-message {
		color: #ffdada; /* 보낸 메시지 차단 시 */
	}
	.message-bubble.received.blocked .blocked-message {
		color: #aaa; /* 받은 메시지 차단 시 */
	}
	.message-bubble.blocked {
		background-color: #f0f0f0;
	}
	.message-bubble.sent.blocked {
		background-color: #dcb8b8;
	}

	.chat-form {
		display: flex;
		gap: 10px;
		padding: 12px 16px;
		background-color: #fff;
		border-top: 1px solid #eee;
		flex-shrink: 0;
	}
	.chat-form input {
		flex: 1;
		padding: 12px;
		border: 1px solid #ddd;
		border-radius: 20px;
		font-size: 16px;
	}
	.chat-form button {
		padding: 10px 20px;
		border-radius: 20px;
		font-weight: bold;
		cursor: pointer;
		border: none;
		transition: 0.2s;
		background-color: #ff6b6b;
		color: white;
	}
	.chat-form button:disabled {
		background-color: #ccc;
		cursor: not-allowed;
	}
</style>