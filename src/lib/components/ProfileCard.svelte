<script>
	import { createEventDispatcher } from 'svelte';

	/**
	 * @type {import('svelte').SvelteComponent}
	 */
	export let profile;
	export let photo;
	export let isBlurred = false;

	const dispatch = createEventDispatcher();
</script>

<div class="profile-card">
	<div class="photo-area">
		<img
			src={photo}
			alt={profile.name + ' 사진'}
			class="main-photo"
			class:blurred={isBlurred}
		/>
		<div class="indicators">
			{#each profile.photos as _, i}
				<div class="indicator-bar {i === 0 ? 'active' : ''}"></div>
			{/each}
		</div>
		<div class="tap-areas">
			<button
				class="tap-left"
				on:click|stopPropagation={() => dispatch('prevPhoto')}
				aria-label="이전 사진"
			></button>
			<button
				class="tap-right"
				on:click|stopPropagation={() => dispatch('nextPhoto')}
				aria-label="다음 사진"
			></button>
		</div>
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
	<button class="btn-pass" on:click={() => dispatch('pass')}>PASS</button>
	<button class="btn-like" on:click={() => dispatch('like')}>LIKE</button>
</div>

<style>
	/* +page.svelte에 있던 스타일 중 ProfileCard와 ActionButtons 관련 스타일을 모두 가져옴 */
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
	.indicators {
		position: absolute;
		top: 8px;
		left: 8px;
		right: 8px;
		display: flex;
		gap: 4px;
		z-index: 10;
	}
	.indicator-bar {
		flex: 1;
		height: 4px;
		background-color: rgba(0, 0, 0, 0.2);
		border-radius: 2px;
	}
	.indicator-bar.active {
		background-color: #fff;
	}
	.tap-areas {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
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
	}
	.btn-pass:active,
	.btn-like:active {
		transform: scale(0.95);
	}
	.btn-pass {
		background-color: #fff;
		color: #ff6b6b;
		border: 2px solid #ff6b6b;
	}
	.btn-like {
		background-color: #fff;
		color: #4ecdc4;
		border: 2px solid #4ecdc4;
	}
</style>