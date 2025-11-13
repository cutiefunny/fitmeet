<script>
	import { page } from '$app/stores';

	let { children } = $props();

	// [ 1. 수정 ] Svelte 5 Runes 모드에 맞게 $: 대신 $derived 사용
	let showNav = $derived(
		$page.route.id === '/' ||
			$page.route.id === '/likes' ||
			$page.route.id?.startsWith('/matches')
	);
</script>

<svelte:head>
	<link rel="icon" href="/icon-192.png" />
</svelte:head>

{@render children()}

{#if showNav}
	<nav class="bottom-nav">
		<a href="/likes" class="nav-item" class:active={$page.route.id === '/likes'}>
			<span class="icon">❤️</span>
			<span class="label">Likes</span>
		</a>
		<a href="/" class="nav-item main" class:active={$page.route.id === '/'}>
			<span class="icon">🔥</span>
			<span class="label">Home</span>
		</a>
		<a
			href="/matches"
			class="nav-item"
			class:active={$page.route.id?.startsWith('/matches')}
		>
			<span class="icon">💬</span>
			<span class="label">Matches</span>
		</a>
	</nav>
{/if}

<style>
	:global(body) {
		margin: 0;
		padding: 0;
	}

	/* 하단 네비게이션 바 스타일 */
	.bottom-nav {
		display: flex;
		justify-content: space-around;
		align-items: center;
		height: 60px; /* 네비게이션 바 높이 */
		background-color: #ffffff;
		border-top: 1px solid #eee;
		position: fixed; /* 화면 하단에 고정 */
		bottom: 0;
		left: 0;
		right: 0;
		/* .app-container와 동일하게 최대 너비 설정 */
		max-width: 500px;
		margin: 0 auto;
		box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
		z-index: 50; /* 모달보다는 아래, 페이지보다는 위에 */
	}

	.nav-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		color: #aaa;
		font-size: 10px;
		font-weight: 500;
		padding: 4px;
		width: 70px;
		transition: color 0.2s;
	}
	.nav-item .icon {
		font-size: 24px;
	}
	.nav-item .label {
		margin-top: 2px;
	}

	.nav-item.main .icon {
		font-size: 28px; /* 홈 아이콘을 더 크게 */
	}

	.nav-item.active {
		color: #ff6b6b; /* 활성 탭 색상 */
		font-weight: bold;
	}
</style>