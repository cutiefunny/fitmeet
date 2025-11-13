<script>
	import { onMount } from 'svelte';
	import { db } from '$lib/firebase';
	import { doc, getDoc, setDoc } from 'firebase/firestore';

	let bannedWords = [];
	let newWord = '';
	let isLoading = true;
	let isSaving = false;

	// Firestore의 'config' 컬렉션, 'filtering' 문서를 참조
	const filteringDocRef = doc(db, 'config', 'filtering');

	// 1. 마운트 시 Firestore에서 단어 리스트 불러오기
	onMount(async () => {
		isLoading = true;
		try {
			const docSnap = await getDoc(filteringDocRef);
			if (docSnap.exists()) {
				// 'bannedWords' 필드의 배열을 가져옴
				bannedWords = docSnap.data().bannedWords || [];
			} else {
				// 문서가 없으면 빈 배열로 시작
				bannedWords = [];
			}
		} catch (error) {
			console.error('Error fetching filter list:', error);
			alert('필터링 단어 목록을 불러오는 데 실패했습니다.');
		} finally {
			isLoading = false;
		}
	});

	// 2. 변경 사항을 Firestore에 저장하는 공통 함수
	async function saveWordList() {
		isSaving = true;
		try {
			// 'bannedWords' 필드에 현재 배열 전체를 덮어쓰기
			await setDoc(filteringDocRef, { bannedWords: bannedWords }, { merge: true });
		} catch (error) {
			console.error('Error saving filter list:', error);
			alert('필터링 단어 목록 저장에 실패했습니다.');
		} finally {
			isSaving = false;
		}
	}

	// 3. 새 단어 추가 핸들러
	function handleAddWord() {
		const trimmedWord = newWord.trim();
		// 입력값이 있고, 중복되지 않을 때만 추가
		if (trimmedWord && !bannedWords.includes(trimmedWord)) {
			bannedWords = [...bannedWords, trimmedWord];
			newWord = '';
			saveWordList(); // 추가 후 즉시 저장
		}
	}

	// 4. 단어 삭제 핸들러
	function handleDeleteWord(wordToDelete) {
		bannedWords = bannedWords.filter((w) => w !== wordToDelete);
		saveWordList(); // 삭제 후 즉시 저장
	}
</script>

<div class="admin-container">
	<div class="header-area">
		<h1>🚫 필터링 단어 관리</h1>
	</div>

	<div class="content-area">
		<form class="add-form" on:submit|preventDefault={handleAddWord}>
			<input
				type="text"
				bind:value={newWord}
				placeholder="새 필터링 단어 (예: 카톡, @@@)"
				disabled={isSaving}
			/>
			<button type="submit" class="btn-add" disabled={isSaving || !newWord.trim()}>
				{isSaving ? '저장중...' : '추가'}
			</button>
		</form>

		<div class="tag-list-container">
			{#if isLoading}
				<p>필터링 단어 목록을 불러오는 중...</p>
			{:else if bannedWords.length === 0}
				<p>등록된 필터링 단어가 없습니다. 위에서 추가해주세요.</p>
			{:else}
				<div class="tag-list">
					{#each bannedWords as word (word)}
						<div class="tag-item">
							<span>{word}</span>
							<button
								class="btn-delete-tag"
								title="{word} 삭제"
								on:click={() => handleDeleteWord(word)}
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
	/* /admin/sports/+page.svelte의 스타일과 동일 */
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
		margin-bottom: 20px;
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
		background: #d1d5db;
		color: #4b5563;
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
		background-color: #ff6b6b;
		color: white;
	}
</style>