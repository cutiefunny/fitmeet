<script>
	import { onMount, onDestroy } from 'svelte';
	import { db, auth } from '$lib/firebase';
	import {
		doc,
		getDoc,
		collection,
		getDocs,
		query,
		where,
		documentId,
		onSnapshot,
		Timestamp,
		setDoc,
		updateDoc,
		arrayRemove,
		deleteDoc
	} from 'firebase/firestore';
	import { onAuthStateChanged } from 'firebase/auth';
	import ProfileDetailModal from '$lib/components/ProfileDetailModal.svelte';
	import ConfirmModal from '$lib/components/ConfirmModal.svelte';

	let currentUser = null;
	let matchList = [];
	let isLoading = true;

	let showProfileModal = false;
	let selectedProfile = null;

	let showConfirmModal = false;
	let confirmModalProps = {};

	let unsubscribeCallbacks = [];

	onMount(() => {
		const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
			if (user) {
				currentUser = user;
				await fetchMatchList(user.uid);
				if (matchList.length > 0) {
					subscribeToLastMessages(user.uid);
				}
			} else {
				currentUser = null;
				isLoading = false;
				cleanupSubscriptions();
			}
		});

		return () => {
			unsubscribeAuth();
			cleanupSubscriptions();
		};
	});

	function cleanupSubscriptions() {
		unsubscribeCallbacks.forEach((unsub) => unsub());
		unsubscribeCallbacks = [];
	}

	async function fetchMatchList(myUid) {
		// ... (이전과 동일)
		isLoading = true;
		try {
			const myProfileRef = doc(db, 'members', myUid);
			const myProfileSnap = await getDoc(myProfileRef);

			if (!myProfileSnap.exists()) {
				isLoading = false;
				return;
			}

			const myProfile = myProfileSnap.data();
			const matchedUids = myProfile.matched || [];

			if (matchedUids.length === 0) {
				matchList = [];
				isLoading = false;
				return;
			}

			const matchesQuery = query(collection(db, 'members'), where(documentId(), 'in', matchedUids));
			const matchesSnapshot = await getDocs(matchesQuery);

			matchList = matchesSnapshot.docs.map((doc) => {
				const profile = doc.data();
				return {
					id: doc.id,
					...profile,
					photo:
						profile.photos && profile.photos.length > 0
							? profile.photos[0]
							: 'https://placehold.co/100x100/grey/white?text=...',
					lastMessage: '...',
					lastMessageTimestamp: null,
					isUnread: false
				};
			});
		} catch (error) {
			console.error('Error fetching match list:', error);
		} finally {
			isLoading = false;
		}
	}

	function subscribeToLastMessages(myUid) {
		// ... (이전과 동일)
		cleanupSubscriptions();

		matchList.forEach((match) => {
			const targetUid = match.id;
			const uids = [myUid, targetUid].sort();
			const chatRoomId = uids.join('_');
			const chatDocRef = doc(db, 'chats', chatRoomId);

			const unsub = onSnapshot(chatDocRef, (docSnap) => {
				const matchIndex = matchList.findIndex((m) => m.id === targetUid);
				if (matchIndex === -1) return;

				if (docSnap.exists()) {
					const chatData = docSnap.data();
					matchList[matchIndex].lastMessage = chatData.lastMessage;
					matchList[matchIndex].lastMessageTimestamp = chatData.lastMessageTimestamp;

					const readBy = chatData.readBy || {};
					const lastSenderId = chatData.lastSenderId;

					if (lastSenderId && lastSenderId !== myUid && readBy[myUid] === false) {
						matchList[matchIndex].isUnread = true;
					} else {
						matchList[matchIndex].isUnread = false;
					}
				} else {
					matchList[matchIndex].lastMessage = '아직 메시지가 없습니다.';
					matchList[matchIndex].lastMessageTimestamp = null;
					matchList[matchIndex].isUnread = false;
				}

				matchList = sortMatchList(matchList);
			});

			unsubscribeCallbacks.push(unsub);
		});
	}

	function sortMatchList(list) {
		// ... (이전과 동일)
		return list.sort((a, b) => {
			const timeA = a.lastMessageTimestamp ? a.lastMessageTimestamp.toMillis() : 0;
			const timeB = b.lastMessageTimestamp ? b.lastMessageTimestamp.toMillis() : 0;
			return timeB - timeA;
		});
	}

	function formatTimestamp(timestamp) {
		// ... (이전과 동일)
		if (!timestamp) return '';
		try {
			const date = timestamp.toDate();
			const now = new Date();
			const diff = now.getTime() - date.getTime();

			const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));

			if (diffDays === 0) {
				return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
			} else if (diffDays === 1) {
				return '어제';
			} else {
				return date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
			}
		} catch (e) {
			return '';
		}
	}

	function showDetails(match) {
		// ... (이전과 동일)
		if (match.isUnread && currentUser) {
			const uids = [currentUser.uid, match.id].sort();
			const chatRoomId = uids.join('_');
			const chatDocRef = doc(db, 'chats', chatRoomId);
			setDoc(chatDocRef, { readBy: { [currentUser.uid]: true } }, { merge: true });
		}

		selectedProfile = match;
		showProfileModal = true;
	}

	function closeModals() {
		showProfileModal = false;
		selectedProfile = null;
	}

	function handleRequestUnmatch() {
		// ... (이전과 동일)
		showProfileModal = false;
		confirmModalProps = {
			title: '매칭 취소',
			message: `${selectedProfile.name}님과의 매칭을 취소하시겠습니까?\n채팅 내역이 모두 삭제되며, 이 작업은 되돌릴 수 없습니다.`,
			confirmText: '매칭 취소'
		};
		showConfirmModal = true;
	}

	function handleCancelUnmatch() {
		// ... (이전과 동일)
		showConfirmModal = false;
		selectedProfile = null;
	}

	async function handleConfirmUnmatch() {
		// ... (이전과 동일)
		if (!currentUser || !selectedProfile) return;

		const myUid = currentUser.uid;
		const targetUid = selectedProfile.id;

		try {
			const myProfileRef = doc(db, 'members', myUid);
			const targetProfileRef = doc(db, 'members', targetUid);
			const p1 = updateDoc(myProfileRef, {
				matched: arrayRemove(targetUid)
			});
			const p2 = updateDoc(targetProfileRef, {
				matched: arrayRemove(myUid)
			});
			const uids = [myUid, targetUid].sort();
			const chatRoomId = uids.join('_');
			const chatDocRef = doc(db, 'chats', chatRoomId);
			const p3 = deleteDoc(chatDocRef);
			await Promise.all([p1, p2, p3]);
			matchList = matchList.filter((m) => m.id !== targetUid);
			const unsubIndex = unsubscribeCallbacks.findIndex(
				(cb) => cb.name === chatRoomId
			);
			if (unsubIndex > -1) {
				unsubscribeCallbacks[unsubIndex]();
				unsubscribeCallbacks.splice(unsubIndex, 1);
			}
		} catch (error) {
			console.error('매칭 취소 중 오류 발생:', error);
			alert('매칭 취소 중 오류가 발생했습니다.');
		} finally {
			showConfirmModal = false;
			selectedProfile = null;
		}
	}
</script>

<div class="app-container">
	<header class="app-header">
		<h1 class="logo">채팅 목록</h1>
	</header>

	<main class="main-content">
		{#if isLoading}
			<div class="empty-state"><p>데이터를 불러오는 중입니다...</p></div>
		{:else if !currentUser}
			<div class="empty-state">
				<p>로그인이 필요합니다.<br />메인 페이지로 돌아가 로그인해주세요.</p>
			</div>
		{:else if matchList.length === 0}
			<div class="empty-state"><p>아직 매치된 상대가 없습니다.</p></div>
		{:else}
			<div class="match-list">
				{#each matchList as match (match.id)}
					<div
						class="match-item"
						class:unread={match.isUnread}
						on:click={() => showDetails(match)}
						on:keydown={(e) => e.key === 'Enter' && showDetails(match)}
						role="button"
						tabindex="0"
					>
						<img src={match.photo} alt={match.name} class="match-avatar" />
						<div class="match-info">
							<h3>{match.name}</h3>
							<p
								class="last-message"
								class:initial={match.lastMessage === '...' ||
									match.lastMessage === '아직 메시지가 없습니다.'}
							>
								{match.lastMessage}
							</p>
						</div>
						<div class="chat-details">
							{#if match.isUnread}
								<div class="unread-dot" title="읽지 않은 메시지" />
							{/if}
							<span class="timestamp">{formatTimestamp(match.lastMessageTimestamp)}</span>
							<a
								href="/chat/{match.id}"
								class="chat-btn"
								sveltekit:prefetch
								on:click|stopPropagation
							>
								채팅
							</a>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</main>

	{#if showProfileModal && selectedProfile}
		<ProfileDetailModal
			profile={selectedProfile}
			context="match"
			on:close={closeModals}
			on:requestUnmatch={handleRequestUnmatch}
		/>
	{/if}

	{#if showConfirmModal}
		<ConfirmModal
			title={confirmModalProps.title}
			message={confirmModalProps.message}
			confirmText={confirmModalProps.confirmText}
			on:confirm={handleConfirmUnmatch}
			on:cancel={handleCancelUnmatch}
		/>
	{/if}
</div>

<style>
	/* ... (모든 스타일 이전과 동일) ... */
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
		height: calc(100dvh - 60px);
		margin: 0 auto;
		background-color: #fff;
		display: flex;
		flex-direction: column;
		box-shadow: 0 0 20px rgba(0, 0, 0, 0.05);
		position: relative;
	}
	.app-header {
		height: 60px;
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 0 20px;
		border-bottom: 1px solid #eee;
	}
	.logo {
		font-size: 24px;
		font-weight: 800;
		color: #ff6b6b;
		margin: 0;
		letter-spacing: -0.5px;
	}
	.main-content {
		flex: 1;
		padding: 16px;
		overflow-y: auto;
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
	.match-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.match-item {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px;
		background-color: #f9f9f9;
		border-radius: 12px;
		cursor: pointer;
		transition: background-color 0.2s;
	}
	.match-item:hover {
		background-color: #f0f2f5;
	}
	.match-avatar {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid #eee;
	}
	.match-info {
		flex: 1;
		min-width: 0;
	}
	.match-info h3 {
		margin: 0 0 4px 0;
		font-size: 18px;
		color: #333;
	}
	.last-message {
		margin: 0;
		font-size: 14px;
		color: #555;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.last-message.initial {
		color: #999;
		font-style: italic;
	}
	.match-item.unread .match-info h3 {
		font-weight: 800;
		color: #000;
	}
	.match-item.unread .last-message {
		font-weight: 700;
		color: #222;
	}
	.chat-details {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
		flex-shrink: 0;
		position: relative;
	}
	.unread-dot {
		width: 10px;
		height: 10px;
		background-color: #ff6b6b;
		border-radius: 50%;
		position: absolute;
		top: -4px;
		right: 0px;
	}
	.timestamp {
		font-size: 12px;
		color: #999;
		white-space: nowrap;
		margin-top: 10px;
	}
	.chat-btn {
		padding: 8px 12px;
		background-color: #ff6b6b;
		color: white;
		border: none;
		border-radius: 8px;
		font-weight: bold;
		cursor: pointer;
		transition: background-color 0.2s;
		text-decoration: none;
		box-sizing: border-box;
		white-space: nowrap;
	}
	.chat-btn:hover {
		background-color: #e55b5b;
	}
</style>