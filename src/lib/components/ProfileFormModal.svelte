<script>
	import { onMount, createEventDispatcher } from 'svelte';
	import { storage } from '$lib/firebase';
	import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

	/**
	 * @type {import('svelte').SvelteComponent}
	 */
	export let user;
	export let existingProfile = null;
	// [ 1. 수정 ] 부모로부터 sportsList prop을 받습니다.
	export let sportsList = [];

	const dispatch = createEventDispatcher();

	// [ 2. 제거 ] 하드코딩된 sportsList 배열을 제거합니다.
	/* const sportsList = [
		'헬스', '러닝', '수영', ...
	];
	*/

	// --- 폼 상태 변수 ---
	let name = '';
	let age = '';
	let gender = '';
	let mainSport = '';
	let secondarySport = '';
	let location = '';
	let bio = '';
	let existingPhotos = [];
	let selectedFiles = [];
	let isUploading = false;
	let uploadStatus = '';
	let isGeneratingName = false;

	// 'generateRandomName' 함수 (API 호출)
	async function generateRandomName() {
		if (isGeneratingName) return;
		isGeneratingName = true;
		try {
			const response = await fetch('https://musclecat.co.kr/generate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					prompt: '강하고 귀여운 한글 닉네임을 6자 이내로 1개만 만들어줘. 닉네임만 주면 돼'
				})
			});
			if (!response.ok) {
				throw new Error(`API Error: ${response.status} ${response.statusText}`);
			}
			const generatedName = (await response.text()).replace(/"/g, '');
			name = generatedName;
		} catch (error) {
			console.error('Error generating random name:', error);
			alert('이름 생성에 실패했습니다. 직접 입력해주세요.');
		} finally {
			isGeneratingName = false;
		}
	}

	onMount(() => {
		name = existingProfile ? existingProfile.name : user.name;
		if (existingProfile) {
			age = existingProfile.age;
			gender = existingProfile.gender;
			mainSport = existingProfile.mainSport;
			secondarySport = existingProfile.secondarySport || '';
			location = existingProfile.location || '';
			bio = existingProfile.bio || '';
			existingPhotos = existingProfile.photos || [];
		} else {
			existingPhotos = user.avatar ? [user.avatar] : [];
		}
	});

	// --- 파일 처리 로직 (동일) ---
	function handleFileSelect(event) {
		const newFiles = Array.from(event.target.files);
		const newEntries = newFiles.map((file) => ({
			file,
			url: URL.createObjectURL(file),
			id: Math.random().toString(36).substring(2, 9)
		}));
		selectedFiles = [...selectedFiles, ...newEntries];
		event.target.value = '';
	}
	function removeNewFile(idToRemove) {
		const entryToRemove = selectedFiles.find((entry) => entry.id === idToRemove);
		if (entryToRemove) {
			URL.revokeObjectURL(entryToRemove.url);
			selectedFiles = selectedFiles.filter((entry) => entry.id !== idToRemove);
		}
	}
	function removeExistingPhoto(urlToRemove) {
		existingPhotos = existingPhotos.filter((url) => url !== urlToRemove);
	}
	async function processImage(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = (event) => {
				const img = new Image();
				img.src = event.target.result;
				img.onload = async () => {
					const maxDim = 600;
					let width = img.width;
					let height = img.height;
					if (width > height) {
						if (width > maxDim) {
							height *= maxDim / width;
							width = maxDim;
						}
					} else {
						if (height > maxDim) {
							width *= maxDim / height;
							height = maxDim;
						}
					}
					const canvas = document.createElement('canvas');
					canvas.width = width;
					canvas.height = height;
					const ctx = canvas.getContext('2d');
					ctx.drawImage(img, 0, 0, width, height);
					canvas.toBlob(
						async (blob) => {
							if (blob) resolve({ blob, ext: 'avif' });
							else
								canvas.toBlob(
									(webpBlob) => resolve({ blob: webpBlob, ext: 'webp' }),
									'image/webp',
									0.8
								);
						},
						'image/avif',
						0.8
					);
				};
				img.onerror = (err) => reject(err);
			};
		});
	}

	// --- 폼 제출 핸들러 (동일) ---
	async function handleSubmit() {
		if (
			!name ||
			!age ||
			!gender ||
			!mainSport ||
			(existingPhotos.length === 0 && selectedFiles.length === 0)
		) {
			alert('이름, 나이, 성별, 주종목 및 1장 이상의 사진은 필수입니다.');
			return;
		}
		isUploading = true;
		uploadStatus = '이미지 처리 중...';

		try {
			const newPhotoUrls = [];
			const timestamp = Date.now();
			for (let i = 0; i < selectedFiles.length; i++) {
				uploadStatus = `새 이미지 ${i + 1} / ${selectedFiles.length} 업로드 중...`;
				const { blob, ext } = await processImage(selectedFiles[i].file);
				const filename = `members/${user.uid}_${timestamp}_${i}.${ext}`;
				const storageRef = ref(storage, filename);
				const snapshot = await uploadBytes(storageRef, blob);
				const downloadURL = await getDownloadURL(snapshot.ref);
				newPhotoUrls.push(downloadURL);
			}
			const finalPhotos = [...existingPhotos, ...newPhotoUrls];
			uploadStatus = '데이터 저장 중...';

			const memberData = {
				name: name,
				age: parseInt(age),
				gender: gender,
				mainSport: mainSport,
				secondarySport: secondarySport,
				location: location,
				bio: bio,
				photos: finalPhotos,
				email: user.email,
				updatedAt: new Date()
			};

			dispatch('submitProfile', memberData);
		} catch (error) {
			console.error('Error processing/uploading images: ', error);
			alert('이미지 처리 중 오류가 발생했습니다: ' + error.message);
			isUploading = false;
			uploadStatus = '';
		}
	}
</script>

<div class="modal-overlay">
	<div class="modal-content form-modal" on:click|stopPropagation>
		<h2>{existingProfile ? '프로필 수정' : '프로필 생성'}</h2>
		<p>FitMeet을 시작하기 위해<br />추가 정보를 입력해주세요.</p>

		<form on:submit|preventDefault={handleSubmit} class="member-form">
			<div class="form-group">
				<label for="name">이름</label>
				<div class="input-with-button">
					<input type="text" id="name" bind:value={name} required />
					<button
						type="button"
						class="btn-random"
						on:click={generateRandomName}
						disabled={isGeneratingName}
					>
						{#if isGeneratingName}
							⏳
						{:else}
							🎲
						{/if}
					</button>
				</div>
			</div>
			<div class="form-group">
				<label for="age">나이</label>
				<input type="number" id="age" bind:value={age} required placeholder="예: 28" />
			</div>
			<div class="form-group">
				<label>성별</label>
				<div class="radio-group">
					<label><input type="radio" bind:group={gender} value="남성" required /> 남성</label>
					<label><input type="radio" bind:group={gender} value="여성" /> 여성</label>
				</div>
			</div>

			<div class="form-group">
				<label for="main-sport">주종목</label>
				<select id="main-sport" bind:value={mainSport} required>
					<option value="" disabled>-- 선택 --</option>
					{#each sportsList as sport}
						<option value={sport}>{sport}</option>
					{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="secondary-sport">부종목 (선택)</label>
				<select id="secondary-sport" bind:value={secondarySport}>
					<option value="">-- 없음 --</option>
					{#each sportsList as sport}
						<option value={sport}>{sport}</option>
					{/each}
				</select>
			</div>
			
			<div class="form-group">
				<label for="location">위치</label>
				<input type="text" id="location" bind:value={location} placeholder="예: 강남구 역삼동" />
			</div>
			<div class="form-group">
				<label for="bio">소개 (Bio)</label>
				<textarea id="bio" bind:value={bio} rows="4" placeholder="자기소개를 입력하세요"></textarea>
			</div>
			<div class="form-group">
				<label>사진 관리</label>
				{#if existingPhotos.length > 0}
					<p class="sub-label">기존 사진</p>
					<div class="preview-area">
						{#each existingPhotos as url}
							<div class="preview-item">
								<img src={url} alt="기존 사진" class="thumbnail" />
								<button
									type="button"
									class="remove-btn"
									on:click={() => removeExistingPhoto(url)}>✕</button
								>
							</div>
						{/each}
					</div>
				{/if}
				<p class="sub-label">새 사진 추가</p>
				<input type="file" id="photos" accept="image/*" multiple on:change={handleFileSelect} />
				{#if selectedFiles.length > 0}
					<div class="preview-area">
						{#each selectedFiles as entry (entry.id)}
							<div class="preview-item new-file">
								<img src={entry.url} alt="새 사진 미리보기" class="thumbnail" />
								<button
									type="button"
									class="remove-btn"
									on:click={() => removeNewFile(entry.id)}>✕</button
								>
							</div>
						{/each}
					</div>
				{/if}
				<p class="hint">* 총 {existingPhotos.length + selectedFiles.length}장의 사진이 저장됩니다.</p>
			</div>
			<button type="submit" class="submit-btn" disabled={isUploading}>
				{isUploading ? uploadStatus : existingProfile ? '수정 완료' : '생성 완료'}
			</button>
		</form>

		<button class="close-modal-btn" on:click={() => dispatch('close')}
			>{existingProfile ? '닫기' : '나중에 하기'}</button
		>
	</div>
</div>

<style>
	.modal-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 100;
	}
	.modal-content {
		background-color: #fff;
		padding: 30px;
		border-radius: 16px;
		width: 80%;
		max-width: 320px;
		text-align: center;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		animation: slideUp 0.3s ease-out;
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
	.modal-content h2 {
		margin-top: 0;
		color: #333;
	}
	.modal-content p {
		color: #666;
		margin-bottom: 24px;
		line-height: 1.5;
	}
	.close-modal-btn {
		background: none;
		border: none;
		color: #999;
		font-size: 14px;
		cursor: pointer;
		padding: 8px;
		text-decoration: underline;
	}
	.modal-content.form-modal {
		max-height: 80dvh;
		overflow-y: auto;
		text-align: left;
	}
	.member-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.radio-group {
		display: flex;
		gap: 20px;
		padding-top: 4px;
	}
	.radio-group label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: normal;
		cursor: pointer;
	}
	input[type='radio'] {
		padding: 0;
		width: auto;
		height: auto;
	}
	label {
		font-weight: bold;
		color: #555;
		font-size: 14px;
	}
	.sub-label {
		font-size: 13px;
		color: #666;
		margin: 4px 0;
		font-weight: 600;
	}
	input[type='text'],
	input[type='number'],
	textarea,
	select {
		padding: 10px;
		border: 1px solid #ddd;
		border-radius: 8px;
		font-size: 15px;
		background-color: white;
	}
	input[type='text']:disabled {
		background-color: #f5f5f5;
		color: #888;
	}
	.input-with-button {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.input-with-button input[type='text'] {
		flex: 1;
		min-width: 0;
	}
	.btn-random {
		padding: 8px 12px;
		background-color: #f0f0f0;
		border: 1px solid #ddd;
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
		line-height: 1.2;
		transition: background-color 0.2s;
	}
	.btn-random:hover {
		background-color: #e0e0e0;
	}
	.btn-random:disabled {
		background-color: #f5f5f5;
		color: #aaa;
		cursor: not-allowed;
	}
	.hint {
		font-size: 12px;
		color: #888;
		margin: 0;
	}
	.preview-area {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
		margin-bottom: 8px;
	}
	.preview-item {
		position: relative;
		width: 70px;
		height: 70px;
	}
	.preview-item.new-file {
		border: 2px solid #4ecdc4;
		border-radius: 10px;
	}
	.thumbnail {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 8px;
		border: 1px solid #eee;
	}
	.remove-btn {
		position: absolute;
		top: -6px;
		right: -6px;
		width: 20px;
		height: 20px;
		background-color: #ff6b6b;
		color: white;
		border: 2px solid #fff;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		font-size: 10px;
		font-weight: bold;
		padding: 0;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}
	.submit-btn {
		padding: 14px;
		background-color: #ff6b6b;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 16px;
		font-weight: bold;
		cursor: pointer;
		margin-top: 10px;
	}
	.submit-btn:disabled {
		background-color: #ccc;
		cursor: not-allowed;
	}
</style>