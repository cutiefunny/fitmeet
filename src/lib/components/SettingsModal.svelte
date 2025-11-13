<script>
	import { createEventDispatcher, onMount } from 'svelte';
	import { db, auth, messaging } from '$lib/firebase';
	import { doc, updateDoc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore';
	import { getToken, deleteToken } from 'firebase/messaging';

	/**
	 * @type {import('svelte').SvelteComponent}
	 */
	export let user;
	const dispatch = createEventDispatcher();

	const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

	// 'loading', 'default', 'granted', 'denied', 'unsupported'
	let masterNotificationStatus = 'loading';
	let isMasterToggleDisabled = true;

	// [ 1. 신규 ] 서브 토글 상태
	let settings = {
		likes: true,
		matches: true,
		chats: true
	};

	let userDocRef; // 사용자 문서 참조

	onMount(() => {
		if (user && user.uid) {
			userDocRef = doc(db, 'members', user.uid);
		}

		// 1. Firestore에서 현재 'notificationSettings' 불러오기
		if (user && user.profile && user.profile.notificationSettings) {
			// user.profile (App.svelte에서 로드)에 최신 설정이 없을 수 있으므로
			// user.profile.notificationSettings를 기본값으로 사용
			settings = { ...settings, ...user.profile.notificationSettings };
		}

		// 2. 브라우저/기기 권한 상태 확인 (마스터 토글)
		if (messaging && 'Notification' in window) {
			masterNotificationStatus = Notification.permission;
			isMasterToggleDisabled = masterNotificationStatus === 'denied';
		} else {
			masterNotificationStatus = 'unsupported';
			isMasterToggleDisabled = true;
		}
	});

	// [ 2. 수정 ] 마스터 토글 핸들러
	async function handleMasterToggleChange(event) {
		const isEnabled = event.target.checked;
		isMasterToggleDisabled = true;
		masterNotificationStatus = 'loading';

		if (isEnabled) {
			await enableMasterNotifications();
		} else {
			await disableMasterNotifications();
		}

		isMasterToggleDisabled = masterNotificationStatus === 'denied';
	}

	// [ 3. 수정 ] 마스터 활성화 (fcmTokens 배열에 추가)
	async function enableMasterNotifications() {
		if (!messaging || !vapidKey || !userDocRef) {
			masterNotificationStatus = 'unsupported';
			return;
		}
		try {
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				masterNotificationStatus = 'denied';
				return;
			}
			const swRegistration = await navigator.serviceWorker.ready;
			const currentToken = await getToken(messaging, {
				vapidKey: vapidKey,
				serviceWorkerRegistration: swRegistration
			});
			if (currentToken) {
				await updateDoc(userDocRef, {
					fcmTokens: arrayUnion(currentToken)
				});
				masterNotificationStatus = 'granted';
			} else {
				masterNotificationStatus = 'default';
			}
		} catch (err) {
			console.error('마스터 알림 활성화 실패:', err);
			masterNotificationStatus = 'default';
		}
	}

	// [ 4. 수정 ] 마스터 비활성화 (fcmTokens 배열에서 제거)
	async function disableMasterNotifications() {
		if (!messaging || !vapidKey || !userDocRef) {
			masterNotificationStatus = 'unsupported';
			return;
		}
		try {
			const swRegistration = await navigator.serviceWorker.ready;
			const currentToken = await getToken(messaging, {
				vapidKey: vapidKey,
				serviceWorkerRegistration: swRegistration
			});
			if (currentToken) {
				await updateDoc(userDocRef, {
					fcmTokens: arrayRemove(currentToken)
				});
				await deleteToken(messaging);
			}
			masterNotificationStatus = 'default';
		} catch (err) {
			console.error('마스터 알림 비활성화 실패:', err);
			masterNotificationStatus = 'default';
		}
	}

	// [ 5. 신규 ] 서브 토글 핸들러 (Firestore 'notificationSettings' 객체 업데이트)
	async function handleSubToggleChange(settingType, isEnabled) {
		if (!userDocRef) return;

		// 1. 로컬 상태 즉시 업데이트
		settings[settingType] = isEnabled;

		try {
			// 2. Firestore 업데이트 (setDoc + merge: true 사용)
			await setDoc(
				userDocRef,
				{
					notificationSettings: {
						[settingType]: isEnabled
					}
				},
				{ merge: true }
			);
			// (user.profile.notificationSettings에도 반영하면 좋지만,
			//  일단 Firestore 업데이트만 수행)
		} catch (e) {
			console.error('알림 설정 업데이트 실패:', e);
			// (오류 시 UI 롤백 - 선택적)
			settings[settingType] = !isEnabled;
		}
	}
</script>

<div class="modal-overlay" on:click={() => dispatch('close')}>
	<div class="modal-content" on:click|stopPropagation>
		<h2>내 프로필</h2>
		<div class="user-info">
			<img src={user.avatar} alt="내 프로필 사진" class="modal-avatar" />
			<div class="user-details">
				<h3>{user.name}</h3>
				<p>{user.email}</p>
				{#if user.profile}
					<p class="like-info">
						남은 LIKE: <span>{user.profile.likeCount ?? 0}</span>개
					</p>
				{/if}
			</div>
		</div>

		<div class="settings-section">
			<h4>알림 설정</h4>
			<div class="setting-item master-toggle">
				<span>전체 알림 받기 (기기)</span>
				<label class="toggle-switch">
					<input
						type="checkbox"
						checked={masterNotificationStatus === 'granted'}
						disabled={isMasterToggleDisabled}
						on:change={handleMasterToggleChange}
					/>
					<span class="slider" />
				</label>
			</div>
			{#if masterNotificationStatus === 'denied'}
				<p class="hint">브라우저 설정에서 알림 권한이 차단되었습니다.</p>
			{/if}
			{#if masterNotificationStatus === 'unsupported'}
				<p class="hint">이 브라우저/기기는 알림을 지원하지 않습니다.</p>
			{/if}

			<div class="sub-settings" class:disabled={masterNotificationStatus !== 'granted'}>
				<div class="setting-item">
					<span>👍 좋아요 알림</span>
					<label class="toggle-switch">
						<input
							type="checkbox"
							bind:checked={settings.likes}
							disabled={masterNotificationStatus !== 'granted'}
							on:change={(e) => handleSubToggleChange('likes', e.target.checked)}
						/>
						<span class="slider" />
					</label>
				</div>
				<div class="setting-item">
					<span>🤝 매칭 알림</span>
					<label class="toggle-switch">
						<input
							type="checkbox"
							bind:checked={settings.matches}
							disabled={masterNotificationStatus !== 'granted'}
							on:change={(e) => handleSubToggleChange('matches', e.target.checked)}
						/>
						<span class="slider" />
					</label>
				</div>
				<div class="setting-item">
					<span>💬 채팅 알림</span>
					<label class="toggle-switch">
						<input
							type="checkbox"
							bind:checked={settings.chats}
							disabled={masterNotificationStatus !== 'granted'}
							on:change={(e) => handleSubToggleChange('chats', e.target.checked)}
						/>
						<span class="slider" />
					</label>
				</div>
			</div>
		</div>

		<div class="modal-actions">
			<button class="edit-profile-btn" on:click={() => dispatch('editProfile')}>프로필 수정</button>
			<button class="logout-btn" on:click={() => dispatch('logout')}>로그아웃</button>
		</div>
		<button class="close-modal-btn" on:click={() => dispatch('close')}>닫기</button>
	</div>
</div>

<style>
	/* ... (기존 스타일 동일) ... */
	.modal-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 100;
	}
	.modal-content {
		background-color: #fff;
		padding: 30px;
		border-radius: 16px;
		width: 80%;
		max-width: 320px;
		text-align: center;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		animation: slideUp 0.3s ease-out;
	}
	@keyframes slideUp {
		from {
			transform: translateY(20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
	.modal-content h2 {
		margin-top: 0;
		color: #333;
	}
	.close-modal-btn {
		background: none;
		border: none;
		color: #999;
		font-size: 14px;
		cursor: pointer;
		padding: 8px;
		text-decoration: underline;
	}
	.user-info {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: 24px;
	}
	.modal-avatar {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		margin-bottom: 12px;
		object-fit: cover;
		border: 3px solid #eee;
	}
	.user-details h3 {
		margin: 0 0 4px 0;
		font-size: 20px;
	}
	.user-details p {
		margin: 0;
		color: #888;
		font-size: 14px;
	}
	.like-info {
		font-size: 14px;
		color: #555;
		margin-top: 8px;
	}
	.like-info span {
		font-weight: bold;
		color: #4ecdc4;
		font-size: 16px;
	}

	/* [ 7. 수정 ] 설정 섹션 스타일 */
	.settings-section {
		text-align: left;
		margin-bottom: 20px;
		border-top: 1px solid #f0f0f0;
		padding-top: 16px;
	}
	.settings-section h4 {
		margin: 0 0 10px 0;
		color: #555;
		font-size: 16px;
	}
	.setting-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 15px;
		color: #333;
	}
	.setting-item.master-toggle {
		font-weight: bold;
		color: #000;
	}
	.hint {
		font-size: 12px;
		color: #ff6b6b;
		margin-top: 8px;
	}
	.sub-settings {
		padding-left: 10px;
		margin-top: 10px;
		border-left: 3px solid #f0f0f0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		transition: opacity 0.3s;
	}
	.sub-settings.disabled {
		opacity: 0.5;
		pointer-events: none;
	}

	/* ... (토글 스위치 CSS 동일) ... */
	.toggle-switch {
		position: relative;
		display: inline-block;
		width: 44px;
		height: 24px;
	}
	.toggle-switch input {
		opacity: 0;
		width: 0;
		height: 0;
	}
	.slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: #ccc;
		transition: 0.4s;
		border-radius: 24px;
	}
	.slider:before {
		position: absolute;
		content: '';
		height: 18px;
		width: 18px;
		left: 3px;
		bottom: 3px;
		background-color: white;
		transition: 0.4s;
		border-radius: 50%;
	}
	input:checked + .slider {
		background-color: #4ecdc4;
	}
	input:checked + .slider:before {
		transform: translateX(20px);
	}
	input:disabled + .slider {
		cursor: not-allowed;
		background-color: #e0e0e0;
	}

	.modal-actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
		margin-bottom: 10px;
	}
	.edit-profile-btn {
		width: 100%;
		padding: 12px;
		background-color: #f0f0f0;
		color: #333;
		border: none;
		border-radius: 8px;
		font-size: 16px;
		font-weight: bold;
		cursor: pointer;
		transition: background-color 0.2s;
	}
	.edit-profile-btn:hover {
		background-color: #e0e0e0;
	}
	.logout-btn {
		width: 100%;
		padding: 12px;
		background-color: #ffe5e5;
		color: #d63031;
		border: none;
		border-radius: 8px;
		font-size: 16px;
		font-weight: bold;
		cursor: pointer;
	}
</style>