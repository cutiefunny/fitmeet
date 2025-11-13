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
		setDoc // [ 1. 'setDoc' 임포트 추가 ]
	} from 'firebase/firestore';
	import { tick } from 'svelte';

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

	async function scrollToBottom() {
		await tick();
		if (messageListEl) {
			messageListEl.scrollTop = messageListEl.scrollHeight;
		}
	}

	// [ 2. markAsRead 함수 추가 ]
	// 현재 채팅방을 '읽음'으로 처리
	async function markAsRead(uid, cId) {
		if (!uid || !cId) return;

		const chatRoomDocRef = doc(db, 'chats', cId);
		try {
			// 'readBy' 맵의 '내' 필드만 'true'로 덮어쓰기 (merge: true)
			await setDoc(
				chatRoomDocRef,
				{
					readBy: {
						[uid]: true
					}
				},
				{ merge: true } // merge: true가 중요
			);
		} catch (e) {
			console.error('읽음 처리 실패:', e);
		}
	}

	onMount(() => {
		unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
			if (user) {
				currentUser = user;

				// 1. 채팅방 ID 생성
				const uids = [user.uid, targetUserId].sort();
				chatRoomId = uids.join('_');
				messagesColRef = collection(db, 'chats', chatRoomId, 'messages');

				// 2. 상대방 정보 가져오기
				try {
					const targetDocRef = doc(db, 'members', targetUserId);
					const targetDocSnap = await getDoc(targetDocRef);
					if (targetDocSnap.exists()) {
						targetUser = targetDocSnap.data();
					}
				} catch (e) {
					console.error('상대방 정보 로딩 실패:', e);
				}

				// 3. 실시간 메시지 리스너 설정
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

						// 4. (중요) 메시지를 불러온 직후, '읽음'으로 처리
						markAsRead(currentUser.uid, chatRoomId);
					},
					(error) => {
						console.error('메시지 수신 오류:', error);
						alert('메시지를 불러오는 데 실패했습니다.');
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

	// [ 3. 'sendMessage' 함수 수정 ]
	async function sendMessage() {
		const text = newMessage.trim();
		if (text === '' || !currentUser || !messagesColRef || !chatRoomId) return;

		newMessage = '';

		const newTimestamp = serverTimestamp();

		try {
			// 1. 'messages' 하위 컬렉션에 새 메시지 추가
			await addDoc(messagesColRef, {
				text: text,
				senderId: currentUser.uid,
				timestamp: newTimestamp
			});

			// 2. 'chats' 상위 문서 업데이트
			const chatRoomDocRef = doc(db, 'chats', chatRoomId);

			// (신규) 'readBy' 맵 생성: 보낸 나는 true, 받는 상대는 false
			const readByStatus = {
				[currentUser.uid]: true,
				[targetUserId]: false
			};

			await setDoc(
				chatRoomDocRef,
				{
					participants: [currentUser.uid, targetUserId],
					lastSenderId: currentUser.uid,
					lastMessage: text,
					lastMessageTimestamp: newTimestamp,
					readBy: readByStatus // '읽지 않음' 상태 추가
				},
				{ merge: true } // participants 필드가 이미 있다면 덮어쓰지 않음
			);

			scrollToBottom();
		} catch (error) {
			console.error('Error sending message:', error);
			alert('메시지 전송에 실패했습니다.');
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
					>
						<p>{message.text}</p>
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
</div>

<style>
	/* ... (스타일은 이전과 동일) ... */
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