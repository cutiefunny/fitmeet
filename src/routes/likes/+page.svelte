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
		documentId,
		writeBatch, // [ 1. 'writeBatch' 임포트 ]
		arrayUnion, // [ 2. 'arrayUnion' 임포트 ]
		increment // [ 3. 'increment' 임포트 ]
	} from 'firebase/firestore';
	import { onAuthStateChanged } from 'firebase/auth';
	import ProfileDetailModal from '$lib/components/ProfileDetailModal.svelte'; // [ 4. 모달 임포트 ]
	import MatchModal from '$lib/components/MatchModal.svelte'; // [ 5. 모달 임포트 ]

	let currentUser = null;
	let likesReceivedList = []; // { id, name, photo, count, ...profile }
	let isLoading = true;

	// [ 6. 신규 ] 모달 상태 변수
	let showProfileModal = false;
	let selectedProfile = null;
	let showMatchModal = false;
	let matchedProfile = null; // MatchModal에 전달할 프로필

	// 'config/stats' 문서 참조 (매치 수 증가용)
	const statsDocRef = doc(db, 'config', 'stats');

	onMount(() => {
		const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
			if (user) {
				currentUser = user;
				await fetchLikesDetails(user.uid);
			} else {
				currentUser = null;
				isLoading = false;
			}
		});
		return unsubscribeAuth;
	});

	async function fetchLikesDetails(myUid) {
		isLoading = true;
		try {
			const myProfileRef = doc(db, 'members', myUid);
			const myProfileSnap = await getDoc(myProfileRef);

			if (!myProfileSnap.exists()) {
				console.error("My profile doesn't exist");
				isLoading = false;
				return;
			}

			const myProfile = myProfileSnap.data();
			const likesCountMap = myProfile.likesReceivedCount;
			const matchedUids = myProfile.matched || [];

			if (!likesCountMap || Object.keys(likesCountMap).length === 0) {
				likesReceivedList = [];
				isLoading = false;
				return;
			}

			const likerUids = Object.keys(likesCountMap);
			const likerUidsToShow = likerUids.filter((uid) => !matchedUids.includes(uid));

			if (likerUidsToShow.length === 0) {
				likesReceivedList = [];
				isLoading = false;
				return;
			}

			const likersQuery = query(collection(db, 'members'), where(documentId(), 'in', likerUidsToShow));
			const likersSnapshot = await getDocs(likersQuery);

			const tempLikerProfiles = {};
			likersSnapshot.docs.forEach((doc) => {
				tempLikerProfiles[doc.id] = doc.data();
			});

			// [ 7. 수정 ] 프로필 전체 데이터 저장
			likesReceivedList = likerUidsToShow
				.map((uid) => {
					const profile = tempLikerProfiles[uid];
					if (!profile) return null; // 프로필 없는 경우 제외

					return {
						id: uid,
						...profile, // <-- 프로필 정보 전체 저장
						photo:
							profile.photos && profile.photos.length > 0
								? profile.photos[0]
								: 'https://placehold.co/100x100/grey/white?text=...',
						count: likesCountMap[uid]
					};
				})
				.filter(Boolean) // null 항목 제거
				.sort((a, b) => b.count - a.count);
		} catch (error) {
			console.error('Error fetching likes details:', error);
		} finally {
			isLoading = false;
		}
	}

	// [ 8. 신규 ] 모달 핸들러
	function showDetails(liker) {
		selectedProfile = liker;
		showProfileModal = true;
	}

	function closeModals() {
		showProfileModal = false;
		showMatchModal = false;
		selectedProfile = null;
		matchedProfile = null;
	}

	// [ 9. 신규 ] PASS 핸들러
	function handlePass() {
		if (!selectedProfile) return;
		// (간단하게 로컬 목록에서만 제거. 영구 '거절'은 로직이 복잡해지므로 일단 생략)
		likesReceivedList = likesReceivedList.filter((l) => l.id !== selectedProfile.id);
		closeModals();
	}

	// [ 10. 신규 ] LIKE 수락 (매치) 핸들러
	async function handleLikeBack() {
		if (!currentUser || !selectedProfile) return;

		const myUid = currentUser.uid;
		const targetUid = selectedProfile.id;

		// 1. 매치될 프로필 정보를 미리 저장
		matchedProfile = selectedProfile;

		try {
			// Firestore 업데이트 (Batch 사용)
			const batch = writeBatch(db);

			// 1. 내 'members' 문서 업데이트: matched 배열에 상대방 추가
			const myProfileRef = doc(db, 'members', myUid);
			batch.update(myProfileRef, {
				matched: arrayUnion(targetUid)
			});

			// 2. 상대방 'members' 문서 업데이트: matched 배열에 나를 추가
			const targetProfileRef = doc(db, 'members', targetUid);
			batch.update(targetProfileRef, {
				matched: arrayUnion(myUid)
			});

			// 3. 'config/stats' 문서 업데이트: totalMatches 1 증가
			batch.update(statsDocRef, {
				totalMatches: increment(1)
			});

			// 4. Batch 실행
			await batch.commit();

			// 5. 모달 상태 변경 (프로필 상세 닫고 -> 매치 모달 열기)
			showProfileModal = false;
			showMatchModal = true;
			// (MatchModal이 닫힐 때 로컬 리스트에서 제거됨, handleMatchModalClose 참조)
		} catch (err) {
			console.error('Error processing Like Back (match):', err);
			alert('매치 처리 중 오류가 발생했습니다.');
		}
	}

	// [ 11. 신규 ] 매치 모달 닫기 핸들러
	function handleMatchModalClose() {
		// 로컬 '받은 LIKE' 목록에서 매치된 사용자 제거
		if (matchedProfile) {
			likesReceivedList = likesReceivedList.filter((l) => l.id !== matchedProfile.id);
		}
		closeModals(); // 모든 모달 닫기
	}
</script>

<div class="app-container">
	<header class="app-header">
		<h1 class="logo">받은 LIKE</h1>
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
					<div
						class="liker-item"
						on:click={() => showDetails(liker)}
						on:keydown={(e) => e.key === 'Enter' && showDetails(liker)}
						role="button"
						tabindex="0"
					>
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

	{#if showProfileModal && selectedProfile}
		<ProfileDetailModal
			profile={selectedProfile}
			context="like"
			on:close={closeModals}
			on:likeBack={handleLikeBack}
			on:pass={handlePass}
		/>
	{/if}

	{#if showMatchModal && matchedProfile && currentUser}
		<MatchModal
			currentUser={currentUser}
			matchedUser={matchedProfile}
			on:close={handleMatchModalClose}
		/>
	{/if}
</div>

<style>
	/* ... (기존 스타일 동일) ... */
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
		/* [ 14. 수정 ] 클릭 가능하도록 스타일 추가 */
		cursor: pointer;
		transition: background-color 0.2s;
	}
	.liker-item:hover {
		background-color: #f0f2f5;
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