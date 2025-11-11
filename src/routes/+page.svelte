<script>
	// Swiper.js CSS 임포트
	import 'swiper/css';
	import 'swiper/css/pagination';

	import { onMount, onDestroy } from 'svelte';
	import { db, auth } from '$lib/firebase';
	import {
		collection,
		getDocs,
		query,
		doc,
		getDoc,
		setDoc,
		Timestamp,
		updateDoc,
		arrayUnion,
		increment,
		addDoc // [ 1. 'addDoc' 임포트 추가 ]
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
	let autoSwipeTimer = null;

	// --- Firebase 인증 상태 감지 ---
	let unsubscribeAuth;
	onMount(async () => {
		// [ 2. 수정 ] onMount 시 'totalVisits' 1 증가
		try {
			// (오류가 나도 앱 실행에 영향이 없도록 try/catch로 감쌈)
			await updateDoc(statsDocRef, {
				totalVisits: increment(1)
			});
		} catch (e) {
			console.warn('방문자 수 집계 실패:', e.message);
			// (stats 문서가 아직 없으면 Firestore가 자동으로 생성하지 않으므로,
			//  최초 1회 수동 생성이 필요할 수 있습니다.)
		}

		isLoading = true;
		try {
			await Promise.all([fetchRecommendations(), fetchSportsList()]);
		} catch (error) {
			console.error('초기 데이터 로딩 실패:', error);
			customAlertMessage = '데이터 로딩 중 오류가 발생했습니다.';
			showCustomAlert = true;
		} finally {
			isLoading = false;
		}

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
					// 'LIKE' 충전 로직 (동일)
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
				}
			} else {
				currentUser = null;
			}
		});
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
			// [ 3. 수정 ] 로그인 성공 시 'loginHistory'에 기록
			const result = await signInWithPopup(auth, provider);
			const user = result.user;

			// 백그라운드에서 로그인 기록 (실패해도 UI에 영향 없음)
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

	// --- 데이터 로딩 및 셔플 ---
	function shuffleArray(array) {
		for (let i = array.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}

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
			throw error;
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
	function nextProfile() {
		if (currentProfileIndex < displayRecommendations.length - 1) {
			currentProfileIndex++;
		} else {
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

	$: {
		if (!currentUser && displayRecommendations.length > 0 && !isLoading) {
			startAutoSwipe();
		} else {
			stopAutoSwipe();
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

				// 1. 'LIKE' 저장
				const myUpdatePromise = updateDoc(myProfileRef, {
					likeCount: newLikeCount,
					[`likesSentCount.${targetUid}`]: increment(1)
				});

				const targetUpdatePromise = updateDoc(targetProfileRef, {
					[`likesReceivedCount.${myUid}`]: increment(1)
				});

				// 'totalLikes' 1 증가
				const statsUpdatePromise = updateDoc(statsDocRef, {
					totalLikes: increment(1)
				});

				await Promise.all([myUpdatePromise, targetUpdatePromise, statsUpdatePromise]);

				// 2. 로컬 상태 업데이트
				currentUser.profile.likeCount = newLikeCount;
				if (!currentUser.profile.likesSentCount) currentUser.profile.likesSentCount = {};
				currentUser.profile.likesSentCount[targetUid] =
					(currentUser.profile.likesSentCount[targetUid] || 0) + 1;

				// 3. 매치 확인
				if (targetProfileData.likesSentCount && targetProfileData.likesSentCount[myUid] > 0) {
					// 🚨 IT'S A MATCH! 🚨

					// 4. 'matched' 필드 업데이트
					const myMatchUpdate = updateDoc(myProfileRef, {
						matched: arrayUnion(targetUid)
					});
					const targetMatchUpdate = updateDoc(targetProfileRef, {
						matched: arrayUnion(myUid)
					});

					// 'totalMatches' 1 증가
					const matchStatsUpdate = updateDoc(statsDocRef, {
						totalMatches: increment(1)
					});

					await Promise.all([myMatchUpdate, targetMatchUpdate, matchStatsUpdate]);

					if (!currentUser.profile.matched) currentUser.profile.matched = [];
					currentUser.profile.matched.push(targetUid);

					matchedProfile = targetProfileData;
					showMatchModal = true;
				} else {
					// 매치가 아니면 다음 프로필로
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
		<h1 class="logo">fitmeet</h1>
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
		{:else if currentProfile}
			<ProfileCard
				bind:this={profileCardInstance}
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
		justify-content: center;
		align-items: center;
		color: #999;
		font-size: 18px;
		text-align: center;
		line-height: 1.6;
	}
</style>