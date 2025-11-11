<script>
	import { createEventDispatcher } from 'svelte';

	/**
	 * @type {import('svelte').SvelteComponent}
	 */
	export let user;

	const dispatch = createEventDispatcher();
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
		<div class="modal-actions">
			<a
				href="/likes"
				class="btn-likes"
				sveltekit:prefetch
				on:click={() => dispatch('close')}
			>
				❤️ 받은 LIKE 확인
			</a>
			<button class="edit-profile-btn" on:click={() => dispatch('editProfile')}>프로필 수정</button>
			<button class="logout-btn" on:click={() => dispatch('logout')}>로그아웃</button>
		</div>
		<button class="close-modal-btn" on:click={() => dispatch('close')}>닫기</button>
	</div>
</div>

<style>
	/* ... (기존 스타일 동일) ... */
	.modal-actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
		margin-bottom: 10px;
	}

	/* [ 2. 링크 버튼 스타일 추가 ] */
	.btn-likes {
		display: block;
		width: 100%;
		padding: 12px;
		background-color: #fce4ec; /* Light pink */
		color: #d81b60; /* Dark pink */
		border: none;
		border-radius: 8px;
		font-size: 16px;
		font-weight: bold;
		cursor: pointer;
		transition: background-color 0.2s;
		text-decoration: none;
		box-sizing: border-box; /* padding이 width 100%를 넘지 않도록 */
	}
	.btn-likes:hover {
		background-color: #f8bbd0;
	}

	/* (이하 기존 스타일 동일) */
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