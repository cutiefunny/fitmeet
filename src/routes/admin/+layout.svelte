<script>
	import { page } from '$app/stores';

	let { children } = $props();
</script>

<div class="admin-layout-container">
	<nav class="admin-menu">
		<div class="menu-header">
			<a href="/" class="home-link" title="메인 페이지로">🏠</a>
			<h2>FitMeet 관리</h2>
		</div>
		<ul>
			<li>
				<a href="/admin" class:active={$page.route.id === '/admin'}>
					📈 대시보드
				</a>
			</li>
			<li>
				<a
					href="/admin/members"
					class:active={$page.route.id?.startsWith('/admin/members')}
				>
					👥 회원 관리
				</a>
			</li>
			<li>
				<a
					href="/admin/sports"
					class:active={$page.route.id?.startsWith('/admin/sports')}
				>
					🏷️ 종목 관리
				</a>
			</li>
		</ul>
	</nav>

	<main class="admin-content">
		{@render children()}
	</main>
</div>

<style>
	/* admin 섹션에만 적용되는 전역 스타일 */
	:global(body) {
		background-color: #f0f2f5;
	}

	.admin-layout-container {
		display: flex;
		height: 100dvh;
	}

	.admin-menu {
		width: 240px;
		flex-shrink: 0;
		background-color: #ffffff;
		border-right: 1px solid #e0e0e0;
		display: flex;
		flex-direction: column;
	}

	.menu-header {
		padding: 20px;
		border-bottom: 1px solid #e0e0e0;
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.menu-header h2 {
		margin: 0;
		font-size: 20px;
		color: #ff6b6b;
	}

	.home-link {
		font-size: 24px;
		text-decoration: none;
		transition: transform 0.2s;
	}
	.home-link:hover {
		transform: scale(1.1);
	}

	.admin-menu ul {
		list-style: none;
		padding: 20px 0;
		margin: 0;
	}

	.admin-menu li a {
		display: block;
		padding: 14px 24px;
		text-decoration: none;
		color: #333;
		font-weight: 500;
		font-size: 16px;
		border-radius: 0 30px 30px 0;
		margin-right: 12px;
		transition:
			background-color 0.2s,
			color 0.2s;
	}

	.admin-menu li a:hover {
		background-color: #f5f7fa;
	}

	.admin-menu li a.active {
		background-color: #ffeff0;
		color: #ff6b6b;
		font-weight: bold;
	}

	.admin-content {
		flex: 1;
		overflow-y: auto;
		padding: 30px;
		height: 100dvh;
		box-sizing: border-box;
	}
</style>