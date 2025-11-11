<script>
	import { onMount } from 'svelte';
	import { db, auth } from '$lib/firebase';
	// [ 1. 필요한 Firestore 함수 임포트 ]
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
	let likesReceivedList = []; // { id, name, photo, count }
	let isLoading = true;

	onMount(() => {
		// [ 2. 로그인 상태 확인 ]
		const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
			if (user) {
				currentUser = user;
				// 로그인 확인 시 '받은 LIKE' 목록 가져오기
				await fetchLikesDetails(user.uid);
			} else {
				currentUser = null;
				isLoading = false;
				// (로그인되지 않은 사용자는 빈 화면을 보게 됨)
			}
		});
		return unsubscribeAuth;
	});

	// [ 3. 데이터 Fetching 함수 ]
	async function fetchLikesDetails(myUid) {
		isLoading = true;
		try {
			// 1. 내 프로필 문서를 가져와서 'likesReceivedCount' 맵을 확보
			const myProfileRef = doc(db, 'members', myUid);
			const myProfileSnap = await getDoc(myProfileRef);

			if (!myProfileSnap.exists()) {
				console.error("My profile doesn't exist");
				isLoading = false;
				return;
			}

			const myProfile = myProfileSnap.data();
			const likesCountMap = myProfile.likesReceivedCount; // 예: { uid1: 5, uid2: 1 }

			// 'LIKE'를 보낸 사람이 아무도 없으면 빈 배열로 종료
			if (!likesCountMap || Object.keys(likesCountMap).length === 0) {
				likesReceivedList = [];
				isLoading = false;
				return;
			}

			// 'LIKE'를 보낸 사람들의 UID 목록
			const likerUids = Object.keys(likesCountMap);

			// 2. 'in' 쿼리를 사용해 'LIKE'를 보낸 사람들의 프로필을 한 번에 가져오기
			// (참고: Firestore 'in' 쿼리는 최대 30개 ID까지 지원합니다.
			//  더 많아지면 쿼리를 분할해야 하지만, 현재 단계에서는 30개로 가정합니다.)
			const likersQuery = query(collection(db, 'members'), where(documentId(), 'in', likerUids));
			const likersSnapshot = await getDocs(likersQuery);

			// (조회를 쉽게 하기 위해 UID를 키로 하는 맵을 임시로 생성)
			const tempLikerProfiles = {};
			likersSnapshot.docs.forEach((doc) => {
				tempLikerProfiles[doc.id] = doc.data();
			});

			// 3. '횟수' 정보와 '프로필' 정보를 결합하여 최종 목록 생성
			likesReceivedList = likerUids
				.map((uid) => {
					const profile = tempLikerProfiles[uid];
					return {
						id: uid,
						name: profile ? profile.name : '알 수 없는 사용자',
						photo:
							profile && profile.photos && profile.photos.length > 0
								? profile.photos[0]
								: 'https://placehold.co/100x100/grey/white?text=...',
						count: likesCountMap[uid] // 'likesReceivedCount' 맵에서 횟수를 가져옴
					};
				})
				// 'LIKE'를 많이 보낸 순서로 정렬
				.sort((a, b) => b.count - a.count);
		} catch (error) {
			console.error('Error fetching likes details:', error);
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="app-container">
	<header class="app-header">
		<a href="/" class="back-link" sveltekit:prefetch>←</a>
		<h1 class="logo">받은 LIKE</h1>
		<div class="placeholder" />
		</header>

	<main class="main-content">
		{#if isLoading}
			<div class="empty-state"><p>데이터를 불러오는 중입니다...</p></div>
		{:else if !currentUser}
			<div class="empty-state">
				<p>로그인이 필요합니다.<br />메인 페이지로 돌아가 로그인해주세요.</p>
			</div>
		{:else if likesReceivedList.length === 0}
			<div class="empty-state"><p>아직 받은 'LIKE'가 없습니다.</p></div>
		{:else}
			<div class="likes-list">
				{#each likesReceivedList as liker (liker.id)}
					<div class="liker-item">
						<img src={liker.photo} alt={liker.name} class="liker-avatar" />
						<div class="liker-info">
							<h3>{liker.name}</h3>
							<p>총 {liker.count}번 'LIKE'를 보냈습니다.</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>

<style>
	/* +page.svelte의 스타일 일부를 재사용하여 일관성 유지 */
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
		width: 40px; /* 로고 중앙 정렬을 위한 너비 */
	}
	.placeholder {
		width: 40px; /* 로고 중앙 정렬을 위한 너비 */
	}
	.main-content {
		flex: 1;
		padding: 16px;
		overflow-y: auto; /* 목록이 길어지면 스크롤 */
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

	/* 이 페이지 전용 스타일 */
	.likes-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.liker-item {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px;
		background-color: #f9f9f9;
		border-radius: 12px;
	}
	.liker-avatar {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid #eee;
	}
	.liker-info h3 {
		margin: 0 0 4px 0;
		font-size: 18px;
		color: #333;
	}
	.liker-info p {
		margin: 0;
		font-size: 14px;
		color: #ff6b6b;
		font-weight: 500;
	}
</style>