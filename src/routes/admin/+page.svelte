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
				<span>(준비중)</span>
			</div>
			<div class="stat-card">
				<h4>오늘 'LIKE' 수</h4>
				<span>(준비중)</span>
			</div>
			<div class="stat-card">
				<h4>총 매치 수</h4>
				<span>(준비중)</span>
			</div>
		</div>
	</div>
</div>

<style>
	/* /admin/members/+page.svelte의 스타일과 일관성을 맞추기 위해 
        .admin-container와 .header-area 스타일을 가져옵니다. 
        (추후 이 스타일들을 공통 CSS로 분리할 수도 있습니다.)
    */
	.admin-container {
		/* 레이아웃의 padding(30px)을 고려하여 max-width 조정 */
		max-width: 900px;
		margin: 0 auto;
		background-color: #f9f9f9;
		border-radius: 16px;
		min-height: calc(100% - 60px); /* 패딩을 고려한 높이 */
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

	/* 대시보드 전용 스타일 */
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