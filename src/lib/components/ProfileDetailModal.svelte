<script>
	import { onMount, createEventDispatcher } from 'svelte';
	// Swiper.js 임포트
	import { register } from 'swiper/element/bundle';
	import 'swiper/css';
	import 'swiper/css/pagination';

	/**
	 * @type {import('svelte').SvelteComponent}
	 */
	export let profile;
	// [ 1. 신규 ] 'match' 또는 'like' 컨텍스트를 받음
	export let context = 'match';
	const dispatch = createEventDispatcher();

	onMount(() => {
		register();
	});

	function handleClose() {
		dispatch('close');
	}

	// [ 2. 신규 ] 이벤트 디스패처
	function requestUnmatch() {
		dispatch('requestUnmatch');
	}
	function requestLikeBack() {
		dispatch('likeBack');
	}
	function requestPass() {
		dispatch('pass');
	}
</script>

<div class="modal-overlay" on:click={handleClose}>
	<div class="modal-content" on:click|stopPropagation>
		<button class="close-btn" on:click={handleClose}>✕</button>

		<div class="profile-card-modal">
			<div class="photo-area">
				<swiper-container
					class="profile-swiper"
					pagination="true"
					loop="false"
					space-between="0"
				>
					{#if profile.photos && profile.photos.length > 0}
						{#each profile.photos as photoUrl}
							<swiper-slide>
								<img src={photoUrl} alt={profile.name + ' 사진'} class="main-photo" />
							</swiper-slide>
						{/each}
					{:else}
						<swiper-slide>
							<img
								src="https://placehold.co/400x400/grey/white?text=No+Photo"
								alt="기본 이미지"
								class="main-photo"
							/>
						</swiper-slide>
					{/if}
				</swiper-container>
			</div>

			<div class="info-area">
				<div class="name-age">
					<h2>{profile.name}</h2>
					<span class="age">{formatAge(profile.age)}, {profile.gender}</span>
				</div>
				{#if profile.mainSport}
					<p class="sports">
						<span class="main-sport">{profile.mainSport}</span>
						{#if profile.secondarySport}
							<span class="secondary-sport">/ {profile.secondarySport}</span>
						{/if}
					</p>
				{/if}
				<p class="location">📍 {profile.location || '위치 정보 없음'}</p>
				<p class="bio">{profile.bio || '소개글이 없습니다.'}</p>

				<div class="modal-actions">
					{#if context === 'match'}
						<button class="btn-unmatch" on:click={requestUnmatch}>
							매칭 취소하기
						</button>
					{:else if context === 'like'}
						<button class="btn-pass" on:click={requestPass}>PASS</button>
						<button class="btn-like" on:click={requestLikeBack}>LIKE 수락</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<script context="module">
	// ... (formatAge 함수 동일)
	function formatAge(age) {
		if (!age || typeof age !== 'number' || age < 10) {
			return '정보 없음';
		}
		const decade = Math.floor(age / 10) * 10;
		const remainder = age % 10;
		let rangeStr = '';
		if (remainder <= 3) rangeStr = '초반';
		else if (remainder <= 6) rangeStr = '중반';
		else rangeStr = '후반';
		if (decade < 20 || decade >= 50) return `${decade}대`;
		return `${decade}대 ${rangeStr}`;
	}
</script>

<style>
	/* ... (modal-overlay, modal-content, close-btn, profile-card-modal, photo-area, info-area 등 스타일 동일) ... */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.6);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 200;
		backdrop-filter: blur(4px);
	}
	.modal-content {
		background-color: #fff;
		border-radius: 16px;
		width: 90%;
		max-width: 450px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		animation: slideUp 0.3s ease-out;
		position: relative;
		max-height: 85vh;
		display: flex;
		flex-direction: column;
	}
	.close-btn {
		position: absolute;
		top: 10px;
		right: 10px;
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: none;
		background: rgba(0, 0, 0, 0.3);
		color: white;
		font-size: 16px;
		font-weight: bold;
		cursor: pointer;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
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
	.profile-card-modal {
		display: flex;
		flex-direction: column;
		border-radius: 16px;
		overflow: hidden;
		background-color: #fff;
		width: 100%;
		max-height: 85vh;
	}
	.photo-area {
		aspect-ratio: 1;
		position: relative;
		background-color: #eee;
		overflow: hidden;
		width: 100%;
		flex-shrink: 0;
	}
	.profile-swiper {
		width: 100%;
		height: 100%;
		--swiper-pagination-top: 8px;
		--swiper-pagination-bottom: auto;
		--swiper-pagination-color: #fff;
		--swiper-pagination-bullet-inactive-color: rgba(0, 0, 0, 0.2);
		--swiper-pagination-bullet-size: 4px;
		--swiper-pagination-bullet-horizontal-gap: 2px;
	}
	.main-photo {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.info-area {
		padding: 20px;
		background: #fff;
		overflow-y: auto;
		flex: 1;
	}
	.name-age {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 8px;
	}
	.name-age h2 {
		margin: 0;
		font-size: 26px;
	}
	.age {
		font-size: 22px;
		font-weight: normal;
	}
	.sports {
		margin: -4px 0 10px 0;
		font-size: 15px;
	}
	.main-sport {
		font-weight: bold;
		color: #ff6b6b;
	}
	.secondary-sport {
		color: #555;
	}
	.location {
		color: #666;
		margin: 0 0 12px 0;
		font-size: 14px;
	}
	.bio {
		margin: 0;
		font-size: 16px;
		line-height: 1.5;
		color: #444;
		word-break: keep-all;
	}

	/* [ 4. 수정 ] 버튼 영역 스타일 */
	.modal-actions {
		display: flex;
		justify-content: center;
		gap: 16px;
		margin-top: 24px;
		padding-top: 16px;
		border-top: 1px solid #f0f0f0;
	}

	/* '매칭 취소' 버튼 (기존) */
	.btn-unmatch {
		background: none;
		border: none;
		color: #999;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		text-decoration: underline;
	}
	.btn-unmatch:hover {
		color: #ff6b6b;
	}

	/* [ 5. 신규 ] 'LIKE 수락' / 'PASS' 버튼 스타일 (ProfileCard.svelte 참고) */
	.btn-pass,
	.btn-like {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		border: none;
		font-weight: bold;
		font-size: 14px;
		cursor: pointer;
		transition: transform 0.1s ease;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
	}
	.btn-like {
		background-color: #fff;
		color: #4ecdc4;
		border: 2px solid #4ecdc4;
	}
	.btn-pass {
		background-color: #fff;
		color: #ff6b6b;
		border: 2px solid #ff6b6b;
	}
	.btn-pass:active,
	.btn-like:active {
		transform: scale(0.95);
	}
</style>