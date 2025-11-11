<script>
	// Swiper.js CSS 임포트
	import 'swiper/css';
	import 'swiper/css/pagination';

	import { onMount, onDestroy } from 'svelte';
	import { db, auth } from '$lib/firebase';
	import { collection, getDocs, query, doc, getDoc, setDoc } from 'firebase/firestore';
	import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

	// 컴포넌트 임포트
	import ProfileCard from '$lib/components/ProfileCard.svelte';
	import LoginModal from '$lib/components/LoginModal.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import ProfileFormModal from '$lib/components/ProfileFormModal.svelte';
	// [ 1. 새 알림 모달 임포트 ]
	import AlertModal from '$lib/components/AlertModal.svelte';

	// --- 로그인 사용자 정보 ---
	let currentUser = null;
	let defaultAvatar = 'https://placehold.co/100x100/indigo/white?text=ME';

	// --- 상태 관리 변수 ---
	let recommendations = [];
	let isLoading = true;
	let currentProfileIndex = 0;

	// --- 모달 상태 변수 ---
	let showLoginModal = false;
	let showSettingsModal = false;
	let showCreateProfileModal = false;

	// [ 2. 커스텀 알림 모달 상태 변수 추가 ]
	let showCustomAlert = false;
	let customAlertMessage = '';

	// --- 자동 스와이프 타이머 변수 ---
	let autoSwipeTimer = null;

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
		stopAutoSwipe();
	});

	// --- 프로필 저장 핸들러 ---
	async function handleSubmitProfile(event) {
		const memberData = event.detail;
		try {
			if (!currentUser.profile) {
				memberData.createdAt = new Date();
			}
			await setDoc(doc(db, 'members', currentUser.uid), memberData, { merge: true });

			if (currentUser.profile) {
				alert('프로필이 수정되었습니다!'); // (참고: 이 alert도 나중에 바꿀 수 있습니다)
			} else {
				alert('프로필 생성이 완료되었습니다! FitMeet에 오신 것을 환영합니다.');
			}
			currentUser.profile = { ...currentUser.profile, ...memberData };
			showCreateProfileModal = false;
		} catch (error) {
			console.error('Error saving profile: ', error);
			// [ 3. 기본 alert을 커스텀 모달로 교체 ]
			customAlertMessage = '프로필 저장 중 오류가 발생했습니다: \n' + error.message;
			showCustomAlert = true;
		}
	}

	// --- 프로필 수정 버튼 핸들러 ---
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
			customAlertMessage = '로그인에 실패했습니다.';
			showCustomAlert = true;
		}
	}

	async function handleLogout() {
		try {
			await signOut(auth);
			showSettingsModal = false;
			customAlertMessage = '로그아웃되었습니다.';
			showCustomAlert = true;
		} catch (error) {
			console.error('Logout error:', error);
			customAlertMessage = '로그아웃 중 오류가 발생했습니다.';
			showCustomAlert = true;
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

	// --- 자동/수동 스와이프 로직 ---
	
	// [ 4. nextProfile 함수 수정: 기본 alert()을 커스텀 모달로 교체 ]
	function nextProfile() {
		if (currentProfileIndex < displayRecommendations.length - 1) {
			currentProfileIndex++;
		} else {
			// 마지막 상대였을 경우
			customAlertMessage = '오늘의 추천이 끝났습니다!\n내일 다시 확인해주세요.';
			showCustomAlert = true;
		}
	}

	function autoSwipe() {
		if (displayRecommendations.length === 0) return;
		currentProfileIndex = (currentProfileIndex + 1) % displayRecommendations.length;
	}

	function startAutoSwipe() {
		if (autoSwipeTimer) return;
		autoSwipeTimer = setInterval(() => {
			autoSwipe();
		}, 3000);
	}

	function stopAutoSwipe() {
		if (autoSwipeTimer) {
			clearInterval(autoSwipeTimer);
			autoSwipeTimer = null;
		}
	}

	// currentUser 상태에 따라 타이머 관리
	$: {
		if (!currentUser && displayRecommendations.length > 0 && !isLoading) {
			startAutoSwipe();
		} else {
			stopAutoSwipe();
		}
	}

	// --- 이벤트 핸들러 ---
	
	function handlePass() {
		// PASS는 애니메이션이 없으므로 즉시 다음 프로필로
		nextProfile();
	}

	// [ 5. handleLike 함수 수정: 애니메이션 타이밍 로직 추가 ]
	function handleLike() {
		// ProfileCard.svelte의 하트 애니메이션(800ms)이
		// 끝날 시간을 기다린 후, nextProfile 로직을 실행합니다.
		setTimeout(() => {
			nextProfile();
		}, 800);
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
				isBlurred={!currentUser}
				buttonsDisabled={!currentUser}
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

	{#if showCustomAlert}
		<AlertModal
			message={customAlertMessage}
			on:close={() => (showCustomAlert = false)}
		/>
	{/if}
</div>

<style>
	/* (스타일은 기존과 동일) */
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