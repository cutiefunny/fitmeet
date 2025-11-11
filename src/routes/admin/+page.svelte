<script>
	import { onMount } from 'svelte';
	import { db } from '$lib/firebase';
	import { doc, getDoc } from 'firebase/firestore';

	let stats = {
		totalMembers: 0,
		totalLikes: 0,
		totalMatches: 0,
		totalVisits: 0 // [ 1. 'totalVisits' 추가 ]
	};
	let isLoading = true;

	onMount(async () => {
		isLoading = true;
		try {
			const statsDocRef = doc(db, 'config', 'stats');
			const docSnap = await getDoc(statsDocRef);

			if (docSnap.exists()) {
				stats = docSnap.data();
			} else {
				console.warn('"config/stats" 문서가 없습니다. 기본값 0을 사용합니다.');
				// [ 2. 기본값에도 'totalVisits' 추가 ]
				stats = { totalMembers: 0, totalLikes: 0, totalMatches: 0, totalVisits: 0 };
			}
		} catch (error) {
			console.error('Error fetching stats:', error);
			alert('대시보드 통계를 불러오는 데 실패했습니다.');
		} finally {
			isLoading = false;
		}
	});
</script>

<div class="admin-container">
	<div class="header-area">
		<h1>📈 대시보드</h1>
	</div>

	<div class="dashboard-content">
		<p>FitMeet 관리자 페이지에 오신 것을 환영합니다!</p>
		<p>왼쪽 메뉴에서 항목을 선택해주세요.</p>

		<div class="stats-grid">
			<div class="stat-card">
				<h4>총 회원 수</h4>
				{#if isLoading}
					<span>...</span>
				{:else}
					<span>{stats.totalMembers || 0}</span>
				{/if}
			</div>
			<div class="stat-card">
				<h4>총 'LIKE' 수</h4>
				{#if isLoading}
					<span>...</span>
				{:else}
					<span>{stats.totalLikes || 0}</span>
				{/if}
			</div>
			<div class="stat-card">
				<h4>총 매치 수</h4>
				{#if isLoading}
					<span>...</span>
				{:else}
					<span>{stats.totalMatches || 0}</span>
				{/if}
			</div>
			<div class="stat-card">
				<h4>총 방문 수</h4>
				{#if isLoading}
					<span>...</span>
				{:else}
					<span>{stats.totalVisits || 0}</span>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	/* ... (스타일은 이전과 동일) ... */
	.admin-container {
		max-width: 900px;
		margin: 0 auto;
		background-color: #f9f9f9;
		border-radius: 16px;
		min-height: calc(100% - 60px);
	}

	.header-area {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 30px;
		padding: 20px 25px;
		border-bottom: 1px solid #eee;
	}
	h1 {
		color: #333;
		margin: 0;
	}
	.dashboard-content {
		padding: 0 25px 25px 25px;
		font-size: 18px;
		color: #555;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 20px;
		margin-top: 30px;
	}

	.stat-card {
		background-color: #fff;
		padding: 20px;
		border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	}

	.stat-card h4 {
		margin: 0 0 10px 0;
		color: #666;
		font-size: 16px;
	}
	.stat-card span {
		font-size: 24px;
		font-weight: bold;
		color: #333;
	}
</style>