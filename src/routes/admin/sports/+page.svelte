<script>
	import { onMount } from 'svelte';
	import { db } from '$lib/firebase';
	import { doc, getDoc, setDoc } from 'firebase/firestore';

	let sports = [];
	let newSport = '';
	let isLoading = true;
	let isSaving = false;

	// Firestore의 'config' 컬렉션, 'sports' 문서를 참조
	const sportsDocRef = doc(db, 'config', 'sports');

	// 1. 마운트 시 Firestore에서 종목 리스트 불러오기
	onMount(async () => {
		isLoading = true;
		try {
			const docSnap = await getDoc(sportsDocRef);
			if (docSnap.exists()) {
				// 'list' 필드의 배열을 가져옴
				sports = docSnap.data().list || [];
			} else {
				// 문서가 없으면 빈 배열로 시작
				sports = [];
			}
		} catch (error) {
			console.error('Error fetching sports list:', error);
			alert('종목 리스트를 불러오는 데 실패했습니다.');
		} finally {
			isLoading = false;
		}
	});

	// 2. 변경 사항을 Firestore에 저장하는 공통 함수
	async function saveSportsList() {
		isSaving = true;
		try {
			// 'list' 필드에 현재 sports 배열 전체를 덮어쓰기
			await setDoc(sportsDocRef, { list: sports }, { merge: true });
		} catch (error) {
			console.error('Error saving sports list:', error);
			alert('종목 리스트 저장에 실패했습니다.');
		} finally {
			isSaving = false;
		}
	}

	// 3. 새 종목 추가 핸들러
	function handleAddSport() {
		const trimmedSport = newSport.trim();
		// 입력값이 있고, 중복되지 않을 때만 추가
		if (trimmedSport && !sports.includes(trimmedSport)) {
			sports = [...sports, trimmedSport];
			newSport = '';
			saveSportsList(); // 추가 후 즉시 저장
		}
	}

	// 4. 종목 삭제 핸들러
	function handleDeleteSport(sportToDelete) {
		sports = sports.filter((s) => s !== sportToDelete);
		saveSportsList(); // 삭제 후 즉시 저장
	}
</script>

<div class="admin-container">
	<div class="header-area">
		<h1>🏷️ 종목 리스트 관리</h1>
	</div>

	<div class="content-area">
		<form class="add-form" on:submit|preventDefault={handleAddSport}>
			<input
				type="text"
				bind:value={newSport}
				placeholder="새 종목 이름 (예: 배드민턴)"
				disabled={isSaving}
			/>
			<button type="submit" class="btn-add" disabled={isSaving || !newSport.trim()}>
				{isSaving ? '저장중...' : '추가'}
			</button>
		</form>

		<div class="tag-list-container">
			{#if isLoading}
				<p>종목 리스트 불러오는 중...</p>
			{:else if sports.length === 0}
				<p>등록된 종목이 없습니다. 위에서 추가해주세요.</p>
			{:else}
				<div class="tag-list">
					{#each sports as sport (sport)}
						<div class="tag-item">
							<span>{sport}</span>
							<button
								class="btn-delete-tag"
								title="{sport} 삭제"
								on:click={() => handleDeleteSport(sport)}
							>
								✕
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	/* /admin/members/+page.svelte의 스타일과 유사하게 구성 */
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
		margin-bottom: 20px; /* members 페이지보다 간격 좁힘 */
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

	.content-area {
		padding: 0 25px 25px 25px;
	}

	/* 새 종목 추가 폼 */
	.add-form {
		display: flex;
		gap: 10px;
		margin-bottom: 25px;
	}

	.add-form input[type='text'] {
		flex: 1;
		padding: 12px;
		border: 1px solid #ddd;
		border-radius: 8px;
		font-size: 16px;
	}

	.btn-add {
		padding: 10px 20px;
		border-radius: 8px;
		font-weight: bold;
		cursor: pointer;
		border: none;
		transition: 0.2s;
		background-color: #ff6b6b;
		color: white;
	}
	.btn-add:hover:not(:disabled) {
		background-color: #e55b5b;
	}
	.btn-add:disabled {
		background-color: #ccc;
		cursor: not-allowed;
	}

	/* 태그 리스트 스타일 */
	.tag-list-container {
		background-color: #fff;
		padding: 25px;
		border-radius: 12px;
		min-height: 200px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}

	.tag-item {
		display: flex;
		align-items: center;
		gap: 6px;
		background-color: #f0f2f5;
		border: 1px solid #e0e0e0;
		border-radius: 20px;
		padding: 8px 14px;
		font-size: 15px;
		font-weight: 500;
		color: #333;
		transition: box-shadow 0.2s;
	}

	.tag-item:hover {
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.btn-delete-tag {
		background: #d1d5db; /* 회색 */
		color: #4b5563; /* 어두운 회색 */
		border: none;
		border-radius: 50%;
		width: 20px;
		height: 20px;
		padding: 0;
		font-size: 12px;
		font-weight: bold;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.2s;
	}
	.btn-delete-tag:hover {
		background-color: #ff6b6b; /* 삭제 호버 */
		color: white;
	}
</style>