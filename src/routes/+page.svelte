<script>
	import { onMount, onDestroy } from 'svelte';
	import { db, auth } from '$lib/firebase';
	import { collection, getDocs, query, doc, getDoc, setDoc } from 'firebase/firestore';
	import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

	// [ 1. 컴포넌트 임포트 ]
	import ProfileCard from '$lib/components/ProfileCard.svelte';
	import LoginModal from '$lib/components/LoginModal.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import ProfileFormModal from '$lib/components/ProfileFormModal.svelte';

	// --- 로그인 사용자 정보 ---
	let currentUser = null;
	let defaultAvatar = 'https://placehold.co/100x100/indigo/white?text=ME';

	// --- 상태 관리 변수 ---
	let recommendations = [];
	let isLoading = true;
	let currentProfileIndex = 0;
	let currentPhotoIndex = 0;

	// --- 모달 상태 변수 ---
	let showLoginModal = false;
	let showSettingsModal = false;
	let showCreateProfileModal = false;

	// --- Firebase 인증 상태 감지 ---
	let unsubscribeAuth;
	onMount(async () => {
		unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
			if (user) {
				currentUser = {
					name: user.displayName,
					email: user.email,
					avatar: user.photoURL || defaultAvatar,
					uid: user.uid
				};
				showLoginModal = false;

				const userProfileRef = doc(db, 'members', user.uid);
				const userProfileSnap = await getDoc(userProfileRef);

				if (!userProfileSnap.exists()) {
					// 프로필이 없으면 생성 모달 띄우기
					showCreateProfileModal = true;
				} else {
					currentUser.profile = userProfileSnap.data();
				}
			} else {
				currentUser = null;
			}
		});

		await fetchRecommendations();
	});

	onDestroy(() => {
		if (unsubscribeAuth) unsubscribeAuth();
	});

	// --- 프로필 저장 핸들러 ---
	// [ 2. 수정됨 ] ProfileFormModal로부터 'submitProfile' 이벤트를 받아서 처리
	async function handleSubmitProfile(event) {
		const memberData = event.detail; // 컴포넌트가 보낸 데이터

		try {
			if (!currentUser.profile) {
				// 생성 시에만 createdAt 추가
				memberData.createdAt = new Date();
			}
			await setDoc(doc(db, 'members', currentUser.uid), memberData, { merge: true });

			if (currentUser.profile) {
				alert('프로필이 수정되었습니다!');
			} else {
				alert('프로필 생성이 완료되었습니다! FitMeet에 오신 것을 환영합니다.');
			}

			currentUser.profile = { ...currentUser.profile, ...memberData }; // 로컬 데이터 갱신
			showCreateProfileModal = false;
		} catch (error) {
			console.error('Error saving profile: ', error);
			alert('프로필 저장 중 오류가 발생했습니다: ' + error.message);
		}
	}

	// --- 프로필 수정 버튼 핸들러 ---
	// [ 3. 수정됨 ] 이제 모달을 켜는 역할만 합니다.
	function handleEditProfile() {
		showSettingsModal = false;
		showCreateProfileModal = true;
	}

	// --- 로그인/로그아웃 핸들러 ---
	async function handleGoogleLogin() {
		const provider = new GoogleAuthProvider();
		try {
			await signInWithPopup(auth, provider);
		} catch (error) {
			console.error('Google login error:', error);
			alert('로그인에 실패했습니다.');
		}
	}

	async function handleLogout() {
		try {
			await signOut(auth);
			showSettingsModal = false;
			alert('로그아웃되었습니다.');
		} catch (error) {
			console.error('Logout error:', error);
			alert('로그아웃 중 오류가 발생했습니다.');
		}
	}

	// --- 모달 핸들러 ---
	function handleProfileClick() {
		if (currentUser) {
			if (!currentUser.profile && showCreateProfileModal) {
				return;
			}
			showSettingsModal = true;
		} else {
			showLoginModal = true;
		}
	}

	function closeModals() {
		showLoginModal = false;
		showSettingsModal = false;
		showCreateProfileModal = false;
	}

	// --- 데이터 로딩 및 셔플 ---
	function shuffleArray(array) {
		for (let i = array.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}

	async function fetchRecommendations() {
		isLoading = true;
		try {
			const q = query(collection(db, 'members'));
			const querySnapshot = await getDocs(q);
			let allMembers = querySnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data()
			}));
			recommendations = shuffleArray(allMembers);
		} catch (error) {
			console.error('Error fetching recommendations:', error);
		} finally {
			isLoading = false;
		}
	}

	// --- Svelte 반응형 선언 ($:) ---
	$: displayRecommendations = recommendations.filter((member) => {
		if (currentUser && currentUser.profile) {
			if (member.id === currentUser.uid) {
				return false;
			}
			if (currentUser.profile.gender === '남성') {
				return member.gender === '여성';
			}
			if (currentUser.profile.gender === '여성') {
				return member.gender === '남성';
			}
			return false;
		} else {
			return true;
		}
	});

	$: currentProfile = displayRecommendations[currentProfileIndex];
	$: currentPhoto = currentProfile ? currentProfile.photos[currentPhotoIndex] : null;

	// --- 이벤트 핸들러 함수 ---
	function nextProfile() {
		if (currentProfileIndex < displayRecommendations.length - 1) {
			currentProfileIndex++;
			currentPhotoIndex = 0;
		} else {
			alert('오늘의 추천이 끝났습니다! 내일 다시 확인해주세요.');
		}
	}
	function prevPhoto() {
		if (currentPhotoIndex > 0) currentPhotoIndex--;
	}
	function nextPhoto() {
		if (currentProfile && currentPhotoIndex < currentProfile.photos.length - 1)
			currentPhotoIndex++;
	}

	// [ 4. ProfileCard 이벤트 핸들러 ]
	// 'like'와 'pass' 모두 nextProfile을 호출합니다.
	function handlePass() {
		nextProfile();
	}
	function handleLike() {
		// (추후 LIKE 로직 추가)
		nextProfile();
	}
</script>

<div class="app-container">
	<header class="app-header">
		<h1 class="logo">fitmeet</h1>
		<button class="user-profile-btn" aria-label="내 프로필" on:click={handleProfileClick}>
			<img
				src={currentUser ? currentUser.avatar : defaultAvatar}
				alt="내 프로필 사진"
				class="user-avatar"
			/>
		</button>
	</header>

	<main class="main-content">
		{#if isLoading}
			<div class="empty-state"><p>추천 상대를 불러오는 중입니다...</p></div>
		{:else if currentProfile}
			<ProfileCard
				profile={currentProfile}
				photo={currentPhoto}
				isBlurred={!currentUser}
				on:prevPhoto={prevPhoto}
				on:nextPhoto={nextPhoto}
				on:pass={handlePass}
				on:like={handleLike}
			/>
		{:else}
			<div class="empty-state">
				{#if !currentUser || !currentUser.profile}
					<p>로그인 및 프로필 생성을<br />완료해주세요.</p>
				{:else}
					<p>더 이상 추천할 회원이 없습니다.</p>
				{/if}
			</div>
		{/if}
	</main>

	{#if showLoginModal}
		<LoginModal on:googleLogin={handleGoogleLogin} on:close={closeModals} />
	{/if}

	{#if showSettingsModal && currentUser}
		<SettingsModal
			user={currentUser}
			on:editProfile={handleEditProfile}
			on:logout={handleLogout}
			on:close={closeModals}
		/>
	{/if}

	{#if showCreateProfileModal && currentUser}
		<ProfileFormModal
			user={currentUser}
			existingProfile={currentUser.profile}
			on:submitProfile={handleSubmitProfile}
			on:close={closeModals}
		/>
	{/if}
</div>

<style>
	/* [ 7. 스타일 대폭 감소 ] 
       컴포넌트로 분리된 스타일은 모두 제거하고,
       +page.svelte의 레이아웃 스타일만 남깁니다.
    */
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
	.user-profile-btn {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}
	.user-avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 2px solid #eee;
		object-fit: cover;
	}
	.main-content {
		flex: 1;
		padding: 16px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
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
</style>