<script>
	import { onMount, createEventDispatcher } from 'svelte';
	import { register } from 'swiper/element/bundle';

	/**
	 * @type {import('svelte').SvelteComponent}
	 */
	export let profile;
	export let isBlurred = false;
	export let buttonsDisabled = false;

	const dispatch = createEventDispatcher();

	onMount(() => {
		register();
	});

	function handleTap(event) {
		event.stopPropagation();
	}

	let heartParticles = [];
	let particleId = 0;

	function handleLikeClick() {
		if (buttonsDisabled) return;

		const newParticles = [];
		for (let i = 0; i < 5; i++) {
			newParticles.push({
				id: particleId++,
				x: Math.random() * 60 - 30,
				delay: Math.random() * 0.3
			});
		}
		heartParticles = [...heartParticles, ...newParticles];

		dispatch('like');
	}

	function removeParticle(id) {
		heartParticles = heartParticles.filter((p) => p.id !== id);
	}
</script>

<div class="profile-card">
	<div class="photo-area">
		<swiper-container
			class="profile-swiper"
			pagination="true"
			loop="false"
			space-between="0"
			disabled={isBlurred}
		>
			{#each profile.photos as photoUrl}
				<swiper-slide>
					<img
						src={photoUrl}
						alt={profile.name + ' 사진'}
						class="main-photo"
						class:blurred={isBlurred}
					/>
				</swiper-slide>
			{/each}

			<div class="tap-areas">
				<div class="tap-left" on:click|stopPropagation={handleTap}></div>
				<div class="tap-right" on:click|stopPropagation={handleTap}></div>
			</div>
		</swiper-container>
	</div>

	<div class="info-area">
		<div class="name-age">
			<h2>{profile.name}</h2>
			<span class="age">{profile.age}, {profile.gender}</span>
		</div>
		{#if profile.mainSport}
			<p class="sports">
				<span class="main-sport">{profile.mainSport}</span>
				{#if profile.secondarySport}
					<span class="secondary-sport">/ {profile.secondarySport}</span>
				{/if}
			</p>
		{/if}
		<p class="location">📍 {profile.location}</p>
		<p class="bio">{profile.bio}</p>
	</div>
</div>

<div class="action-buttons">
	<button class="btn-pass" on:click={() => dispatch('pass')} disabled={buttonsDisabled}>PASS</button>

	<button class="btn-like" on:click={handleLikeClick} disabled={buttonsDisabled}>
		LIKE

		{#if heartParticles.length > 0}
			<div class="particles-container">
				{#each heartParticles as particle (particle.id)}
					<div
						class="heart-particle"
						style="--x: {particle.x}px; --delay: {particle.delay}s;"
						on:animationend={() => removeParticle(particle.id)}
					>
						❤️
					</div>
				{/each}
			</div>
		{/if}
	</button>
</div>

<style>
	/* ... (기존 스타일 대부분 동일) ... */

	.btn-pass,
	.btn-like {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		border: none;
		font-weight: bold;
		font-size: 14px;
		cursor: pointer;
		transition: transform 0.1s ease;
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);

		position: relative;
		z-index: 10; /* 버튼이 파티클 위에 보이도록 z-index 설정 */
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

	.btn-pass:disabled,
	.btn-like:disabled {
		background-color: #f0f0f0;
		color: #ccc;
		border-color: #f0f0f0;
		cursor: not-allowed;
		transform: none;
	}

	.particles-container {
		position: absolute;
		top: 100%;
		left: 50%;
		width: 1px;
		height: 1px;
		pointer-events: none;
		z-index: 20;
	}

	.heart-particle {
		position: absolute;
		bottom: 0;
		left: 0;
		/* [ 1. 수정 ] 폰트 크기 2배 */
		font-size: 32px; /* 16px -> 32px */
		opacity: 1;

		animation: fountain-effect 0.8s ease-out;
		animation-delay: var(--delay);
		transform: translateX(var(--x));
	}

	@keyframes fountain-effect {
		0% {
			transform: translate(var(--x), 0) scale(1);
			opacity: 1;
		}
		100% {
			/* [ 2. 수정 ] 수직 이동 거리도 2배로 증가 */
			transform: translate(var(--x), -240px) scale(0.5); /* -120px -> -240px */
			opacity: 0;
		}
	}

	/* (이하 기존 스타일은 동일) */
	.profile-card {
		flex: 1;
		display: flex;
		flex-direction: column;
		border-radius: 16px;
		overflow: hidden;
		background-color: #fff;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
		margin-bottom: 20px;
		position: relative;
	}
	.photo-area {
		aspect-ratio: 1;
		position: relative;
		background-color: #eee;
		overflow: hidden;
		width: 100%;
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
		transition:
			filter 0.3s ease,
			transform 0.3s ease;
	}
	.main-photo.blurred {
		filter: blur(12px);
		transform: scale(1.05);
	}
	.tap-areas {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		z-index: 5;
	}
	.tap-left,
	.tap-right {
		flex: 1;
		opacity: 0;
		cursor: pointer;
	}
	.info-area {
		padding: 20px;
		background: #fff;
		flex: 1;
		overflow: auto;
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
	.action-buttons {
		display: flex;
		justify-content: center;
		gap: 20px;
		margin-bottom: 10px;
	}
</style>