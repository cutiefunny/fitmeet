<script>
	import { onMount } from 'svelte';
	import { db, auth } from '$lib/firebase';
	import {
		doc,
		getDoc,
		collection,
		getDocs,
		query,
		where,
		documentId
	} from 'firebase/firestore';
	import { onAuthStateChanged } from 'firebase/auth';

	let currentUser = null;
	let matchList = []; // { id, name, photo, (email 등) }
	let isLoading = true;

	onMount(() => {
		const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
			if (user) {
				currentUser = user;
				await fetchMatchList(user.uid);
			} else {
				currentUser = null;
				isLoading = false;
			}
		});
		return unsubscribeAuth;
	});

	async function fetchMatchList(myUid) {
		isLoading = true;
		try {
			// 1. 내 프로필 문서를 가져와서 'matched' 배열 확보
			const myProfileRef = doc(db, 'members', myUid);
			const myProfileSnap = await getDoc(myProfileRef);

			if (!myProfileSnap.exists()) {
				console.error("My profile doesn't exist");
				isLoading = false;
				return;
			}

			const myProfile = myProfileSnap.data();
			const matchedUids = myProfile.matched;

			// 2. 매치된 사람이 아무도 없으면 빈 배열로 종료
			if (!matchedUids || matchedUids.length === 0) {
				matchList = [];
				isLoading = false;
				return;
			}

			// 3. 'in' 쿼리를 사용해 매치된 사람들의 프로필을 한 번에 가져오기
			// (Firestore 'in' 쿼리는 최대 30개 ID까지 지원)
			const matchesQuery = query(collection(db, 'members'), where(documentId(), 'in', matchedUids));
			const matchesSnapshot = await getDocs(matchesQuery);

			// 4. 최종 목록 생성
			matchList = matchesSnapshot.docs.map((doc) => {
				const profile = doc.data();
				return {
					id: doc.id,
					name: profile.name || '알 수 없는 사용자',
					photo:
						profile.photos && profile.photos.length > 0
							? profile.photos[0]
							: 'https://placehold.co/100x100/grey/white?text=...',
					// (추후 채팅을 위해 이메일 등 다른 정보도 추가 가능)
					email: profile.email 
				};
			});
			
		} catch (error) {
			console.error('Error fetching match list:', error);
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="app-container">
	<header class="app-header">
		<a href="/" class="back-link" sveltekit:prefetch>←</a>
		<h1 class="logo">매칭 목록</h1>
		<div class="placeholder" />
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
					<div class="match-item">
						<img src={match.photo} alt={match.name} class="match-avatar" />
						<div class="match-info">
							<h3>{match.name}</h3>
							<p>연락처: {match.email}</p> 
							</div>
						<button class="chat-btn">채팅하기</button>
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>

<style>
	/* likes/+page.svelte의 스타일을 기반으로 수정 */
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
		background-color: #fff;
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
	}
	.logo {
		font-size: 24px;
		font-weight: 800;
		color: #ff6b6b;
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

	/* 매칭 목록 스타일 */
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
	}
	.match-avatar {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid #eee;
	}
	.match-info {
		flex: 1; /* 남은 공간 모두 차지 */
	}
	.match-info h3 {
		margin: 0 0 4px 0;
		font-size: 18px;
		color: #333;
	}
	.match-info p {
		margin: 0;
		font-size: 14px;
		color: #555; /* 'LIKE'와 색상 구분 */
		font-weight: 500;
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
	}
	.chat-btn:hover {
		background-color: #e55b5b;
	}
</style>