<script>
	// [ 1. Swiper 임포트 추가 ]
	import { register } from 'swiper/element/bundle';
	import 'swiper/css';
	import 'swiper/css/pagination';
	import 'swiper/css/effect-fade'; // 페이드 효과

	import { onMount, onDestroy } from 'svelte';
	import { db, auth, functions } from '$lib/firebase';
	import { httpsCallable } from 'firebase/functions';
	import {
		doc,
		getDoc,
		setDoc,
		Timestamp,
		updateDoc,
		arrayUnion,
		increment,
		addDoc,
		collection // [ 1. collection 임포트 추가 (handleGoogleLogin용) ]
	} from 'firebase/firestore';
	import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

	// 컴포넌트 임포트
	import ProfileCard from '$lib/components/ProfileCard.svelte';
	import LoginModal from '$lib/components/LoginModal.svelte';
	import SettingsModal from '$lib/components/SettingsModal.svelte';
	import ProfileFormModal from '$lib/components/ProfileFormModal.svelte';
	import AlertModal from '$lib/components/AlertModal.svelte';
	import MatchModal from '$lib/components/MatchModal.svelte';

	// 'config/stats' 문서 참조
	const statsDocRef = doc(db, 'config', 'stats');

	// [ 3. 정적 이미지 목록 ]
	const guestImages = [
		'/images/man1-1.jpg',
		'/images/woman1-1.jpg',
		'/images/man1-2.jpg',
		'/images/woman1-2.jpg',
		'/images/man2-1.jpg',
		'/images/woman1-3.jpg'
	];

	let currentUser = null;
	let defaultAvatar = 'https://placehold.co/100x100/indigo/white?text=ME';
	let recommendations = [];
	let sportsList = [];
	let isLoading = true;
	let currentProfileIndex = 0;
	let profileCardInstance;
	let showLoginModal = false;
	let showSettingsModal = false;
	let showCreateProfileModal = false;
	let showCustomAlert = false;
	let customAlertMessage = '';
	let showMatchModal = false;
	let matchedProfile = null;

	// --- Firebase 인증 상태 감지 ---
	let unsubscribeAuth;
	onMount(async () => {
		// [ 2. onMount 수정 ] Swiper 등록
		register();

		// 방문자 수 집계
		try {
			await updateDoc(statsDocRef, {
				totalVisits: increment(1)
			});
		} catch (e) {
			console.warn('방문자 수 집계 실패:', e.message);
		}

		// 스포츠 목록 로드
		try {
			await fetchSportsList();
		} catch (error) {
			console.error('초기 데이터 로딩 실패:', error);
			customAlertMessage = '데이터 로딩 중 오류가 발생했습니다.';
			showCustomAlert = true;
		}

		// 인증 상태 감지
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
					isLoading = false;
					recommendations = [];
				} else {
					currentUser.profile = userProfileSnap.data();
					// 'LIKE' 충전 로직
					const profile = currentUser.profile;
					const today = new Date();
					const lastRechargeDate = profile.lastLikeRecharge
						? profile.lastLikeRecharge.toDate()
						: null;
					if (!lastRechargeDate || !isSameDay(today, lastRechargeDate)) {
						const currentLikes = profile.likeCount ?? 0;
						if (currentLikes < 3) {
							try {
								await updateDoc(userProfileRef, {
									likeCount: 3,
									lastLikeRecharge: Timestamp.fromDate(today)
								});
								currentUser.profile.likeCount = 3;
								currentUser.profile.lastLikeRecharge = Timestamp.fromDate(today);
							} catch (err) {
								console.error('Like recharge error: ', err);
							}
						}
					}
					// 프로필 확인 후 추천 로드
					await fetchRecommendations();
				}
			} else {
				currentUser = null;
				isLoading = false;
				recommendations = [];
			}
		});
	});

	onDestroy(() => {
		if (unsubscribeAuth) unsubscribeAuth();
	});

	// --- 프로필 저장 핸들러 ---
	async function handleSubmitProfile(event) {
		const memberData = event.detail;
		try {
			if (!currentUser.profile) {
				memberData.createdAt = new Date();
				memberData.likeCount = 3;
				memberData.lastLikeRecharge = new Date();
				memberData.likesSentCount = {};
				memberData.likesReceivedCount = {};
				memberData.matched = [];
				await setDoc(doc(db, 'members', currentUser.uid), memberData, { merge: true });
				await updateDoc(statsDocRef, {
					totalMembers: increment(1)
				});
			} else {
				await setDoc(doc(db, 'members', currentUser.uid), memberData, { merge: true });
			}

			if (currentUser.profile) {
				alert('프로필이 수정되었습니다!');
			} else {
				alert('프로필 생성이 완료되었습니다! FitMeet에 오신 것을 환영합니다.');
			}
			currentUser.profile = { ...currentUser.profile, ...memberData };
			showCreateProfileModal = false;

			if (!memberData.updatedAt) {
				await fetchRecommendations();
			}
		} catch (error) {
			console.error('Error saving profile: ', error);
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
			const result = await signInWithPopup(auth, provider);
			const user = result.user;
			try {
				await addDoc(collection(db, 'loginHistory'), {
					userId: user.uid,
					email: user.email,
					name: user.displayName,
					timestamp: new Date()
				});
			} catch (historyError) {
				console.error('로그인 기록 저장 실패:', historyError);
			}
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

	function handleMatchModalClose() {
		showMatchModal = false;
		nextProfile();
	}

	// --- 데이터 로딩 ---
	function isSameDay(date1, date2) {
		if (!date1 || !date2) return false;
		return (
			date1.getFullYear() === date2.getFullYear() &&
			date1.getMonth() === date2.getMonth() &&
			date1.getDate() === date2.getDate()
		);
	}

	async function fetchSportsList() {
		try {
			const sportsDocRef = doc(db, 'config', 'sports');
			const docSnap = await getDoc(sportsDocRef);
			if (docSnap.exists()) {
				sportsList = docSnap.data().list || [];
			} else {
				console.warn('Firestore "config/sports" 문서가 없습니다.');
				sportsList = [];
			}
		} catch (error) {
			console.error('Error fetching sports list:', error);
			throw error;
		}
	}

	async function fetchRecommendations() {
		isLoading = true;
		try {
			const getRecommendations = httpsCallable(functions, 'getRecommendations');
			const result = await getRecommendations();
			recommendations = result.data;
		} catch (error) {
			console.error('Error fetching recommendations:', error);
			if (error.code === 'unauthenticated' || error.code === 'not-found') {
				customAlertMessage = '추천을 받으려면 프로필이 필요합니다.';
			} else {
				customAlertMessage = '추천 목록을 불러오는 데 실패했습니다.';
			}
			showCustomAlert = true;
			recommendations = [];
		} finally {
			isLoading = false;
		}
	}

	// --- Svelte 반응형 선언 ($:) ---
	$: displayRecommendations = recommendations.filter((member) => {
		if (currentUser && currentUser.profile) {
			if (member.id === currentUser.uid) return false;
			if (currentUser.profile.matched && currentUser.profile.matched.includes(member.id)) {
				return false;
			}
			return true;
		}
		return false;
	});
	$: currentProfile = displayRecommendations[currentProfileIndex];

	// --- 스와이프 로직 ---
	function nextProfile() {
		if (currentProfileIndex < displayRecommendations.length - 1) {
			currentProfileIndex++;
		} else {
			customAlertMessage = '오늘의 추천이 끝났습니다!\n내일 다시 확인해주세요.';
			showCustomAlert = true;
		}
	}

	// --- 이벤트 핸들러 ---
	function handlePass() {
		nextProfile();
	}

	async function handleLike() {
		const currentLikes = currentUser.profile.likeCount ?? 0;
		if (currentLikes <= 0) {
			customAlertMessage = '오늘 사용할 수 있는\n\'LIKE\'를 모두 사용했습니다.';
			showCustomAlert = true;
			return;
		}

		if (profileCardInstance) {
			profileCardInstance.triggerHeartAnimation();
		}

		setTimeout(async () => {
			try {
				const newLikeCount = currentLikes - 1;
				const myUid = currentUser.uid;
				const targetUid = currentProfile.id;
				const targetProfileData = currentProfile;

				const myProfileRef = doc(db, 'members', myUid);
				const targetProfileRef = doc(db, 'members', targetUid);

				const myUpdatePromise = updateDoc(myProfileRef, {
					likeCount: newLikeCount,
					[`likesSentCount.${targetUid}`]: increment(1)
				});

				const targetUpdatePromise = updateDoc(targetProfileRef, {
					[`likesReceivedCount.${myUid}`]: increment(1)
				});

				const statsUpdatePromise = updateDoc(statsDocRef, {
					totalLikes: increment(1)
				});

				await Promise.all([myUpdatePromise, targetUpdatePromise, statsUpdatePromise]);

				currentUser.profile.likeCount = newLikeCount;
				if (!currentUser.profile.likesSentCount) currentUser.profile.likesSentCount = {};
				currentUser.profile.likesSentCount[targetUid] =
					(currentUser.profile.likesSentCount[targetUid] || 0) + 1;

				if (targetProfileData.likesSentCount && targetProfileData.likesSentCount[myUid] > 0) {
					const myMatchUpdate = updateDoc(myProfileRef, {
						matched: arrayUnion(targetUid)
					});
					const targetMatchUpdate = updateDoc(targetProfileRef, {
						matched: arrayUnion(myUid)
					});
					const matchStatsUpdate = updateDoc(statsDocRef, {
						totalMatches: increment(1)
					});

					await Promise.all([myMatchUpdate, targetMatchUpdate, matchStatsUpdate]);

					if (!currentUser.profile.matched) currentUser.profile.matched = [];
					currentUser.profile.matched.push(targetUid);
					matchedProfile = targetProfileData;
					showMatchModal = true;
				} else {
					nextProfile();
				}
			} catch (err) {
				console.error('Error processing like: ', err);
				customAlertMessage = 'LIKE 처리 중 오류가 발생했습니다.';
				showCustomAlert = true;
			}
		}, 800);
	}
</script>

<div class="app-container">
	<header class="app-header">
		<h1 class="logo">FitMeet</h1>
		<div class="user-actions">
			{#if currentUser && currentUser.profile}
				<div class="header-like-counter">
					❤️ <span>{currentUser.profile.likeCount ?? 0}</span>
				</div>
			{/if}
			<button class="user-profile-btn" aria-label="내 프로필" on:click={handleProfileClick}>
				<img
					src={currentUser ? currentUser.avatar : defaultAvatar}
					alt="내 프로필 사진"
					class="user-avatar"
				/>
			</button>
		</div>
	</header>

	<main class="main-content">
		{#if isLoading}
			<div class="empty-state"><p>추천 상대를 불러오는 중입니다...</p></div>
		{:else if !currentUser}
			<div class="empty-state">
				<div class="guest-swiper-container">
					<swiper-container
						effect="fade"
						autoplay-delay="5000"
						autoplay-pause-on-mouse-enter="false"
						loop="true"
						speed="1000"
						class="guest-swiper"
					>
						{#each guestImages as img}
							<swiper-slide>
								<img src={img} alt="추천 회원 예시" class="blurred-photo" />
							</swiper-slide>
						{/each}
					</swiper-container>
				</div>

				<p>로그인하고<br />새로운 핏메이트를 찾아보세요!</p>
				<button class="btn-login-main" on:click={handleProfileClick}>
					🚀 구글 계정으로 시작하기
				</button>
			</div>
		{:else if showCreateProfileModal}
			<div class="empty-state">
				<p>프로필을 생성하고<br />추천을 받아보세요!</p>
			</div>
		{:else if currentProfile}
			<ProfileCard
				bind:this={profileCardInstance}
				profile={currentProfile}
				isBlurred={false}
				buttonsDisabled={false}
				on:pass={handlePass}
				on:like={handleLike}
			/>
		{:else}
			<div class="empty-state">
				<p>더 이상 추천할 회원이 없습니다.<br />내일 다시 확인해주세요!</p>
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
			sportsList={sportsList}
			on:submitProfile={handleSubmitProfile}
			on:close={closeModals}
		/>
	{/if}
	{#if showCustomAlert}
		<AlertModal message={customAlertMessage} on:close={() => (showCustomAlert = false)} />
	{/if}
	{#if showMatchModal && matchedProfile}
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
	.user-actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.header-like-counter {
		font-size: 18px;
		color: #333;
		font-weight: 500;
		display: flex;
		align-items: center;
	}
	.header-like-counter span {
		font-weight: bold;
		font-size: 20px;
		color: #ff6b6b;
		margin-left: 4px;
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
		flex-direction: column;
		justify-content: center;
		align-items: center;
		color: #999;
		font-size: 18px;
		text-align: center;
		line-height: 1.6;
	}

	.btn-login-main {
		background-color: #ff6b6b;
		color: white;
		border: none;
		padding: 14px 24px;
		border-radius: 30px;
		font-size: 16px;
		font-weight: bold;
		cursor: pointer;
		margin-top: 20px;
		transition: background-color 0.2s;
	}
	.btn-login-main:hover {
		background-color: #e55b5b;
	}

	/* [ 5. CSS 추가 ] 게스트 슬라이드쇼 */
	.guest-swiper-container {
		width: 100%;
		aspect-ratio: 1;
		border-radius: 16px;
		overflow: hidden;
		margin-bottom: 24px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
	}
	.guest-swiper {
		width: 100%;
		height: 100%;
	}
	.blurred-photo {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: blur(5px);
		transform: scale(1.1); /* 블러 가장자리를 부드럽게 */
	}
</style>