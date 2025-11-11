<script>
	import { onMount } from 'svelte';
	import { db } from '$lib/firebase';
	import { collection, query, getDocs, orderBy } from 'firebase/firestore';

	let history = [];
	let isLoading = true;

	onMount(async () => {
		isLoading = true;
		try {
			// 'loginHistory' 컬렉션에서 'timestamp' 필드를 기준으로 내림차순 정렬
			const q = query(collection(db, 'loginHistory'), orderBy('timestamp', 'desc'));
			const querySnapshot = await getDocs(q);

			history = querySnapshot.docs.map((doc) => ({
				id: doc.id,
				...doc.data()
			}));
		} catch (error) {
			console.error('Error fetching login history:', error);
			alert('로그인 기록을 불러오는 데 실패했습니다.');
		} finally {
			isLoading = false;
		}
	});

	// 타임스탬프 포맷팅 헬퍼 함수
	function formatDate(timestamp) {
		if (!timestamp) return '날짜 정보 없음';
		// Firestore Timestamp 객체를 Date 객체로 변환
		const date = timestamp.toDate();
		return date.toLocaleString('ko-KR', {
			year: 'numeric',
			month: 'numeric',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}
</script>

<div class="admin-container">
	<div class="header-area">
		<h1>📜 로그인 기록</h1>
	</div>

	<div class="list-container fade-in">
		{#if isLoading}
			<p class="loading-text">데이터 불러오는 중...</p>
		{:else if history.length === 0}
			<div class="empty-list">
				<p>로그인 기록이 없습니다.</p>
			</div>
		{:else}
			<div class="history-list">
				<div class="history-item header-row">
					<div class="item-name">이름</div>
					<div class="item-email">이메일</div>
					<div class="item-timestamp">로그인 시간</div>
				</div>
				{#each history as item (item.id)}
					<div class="history-item">
						<div class="item-name">{item.name || '(이름 없음)'}</div>
						<div class="item-email">{item.email}</div>
						<div class="item-timestamp">{formatDate(item.timestamp)}</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	/* members/+page.svelte의 스타일 재사용 */
	.admin-container {
		max-width: 900px;
		margin: 0 auto;
		background-color: #f9f9f9;
		border-radius: 16px;
		min-height: 100%;
		box-sizing: border-box;
	}

	.header-area {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 30px;
		padding: 20px 25px;
		border-bottom: 1px solid #eee;
		background-color: #fff;
		border-radius: 16px 16px 0 0;
	}
	h1 {
		color: #333;
		margin: 0;
		font-size: 22px;
	}

	.fade-in {
		animation: fadeIn 0.3s ease-in-out;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.list-container {
		display: flex;
		flex-direction: column;
		gap: 15px;
		padding: 0 25px 25px 25px;
		background-color: #fff;
		border-radius: 0 0 12px 12px;
	}

	.loading-text,
	.empty-list {
		text-align: center;
		color: #999;
		padding: 40px 0;
		font-size: 18px;
	}

	/* 로그인 기록 리스트 스타일 */
	.history-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
	}

	.history-item {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 15px;
		border-radius: 8px;
		background: #fdfdfd;
		border: 1px solid #eee;
	}

	.history-item.header-row {
		background-color: #f5f7fa;
		font-weight: bold;
		color: #333;
		padding: 12px 15px;
	}

	.item-name {
		flex: 1.5;
		min-width: 100px;
		font-weight: 500;
	}
	.item-email {
		flex: 2;
		min-width: 150px;
		color: #555;
	}
	.item-timestamp {
		flex: 2;
		min-width: 180px;
		color: #888;
		font-size: 14px;
	}

	.header-row .item-name,
	.header-row .item-email,
	.header-row .item-timestamp {
		font-weight: bold;
		color: #333;
		font-size: 14px;
	}
</style>