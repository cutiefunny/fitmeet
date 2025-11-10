<script>
    import { onMount } from 'svelte';
    import { db, storage } from '$lib/firebase';
    import { collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
    import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

    // 운동 종목 리스트
    const sportsList = [
        '헬스', '러닝', '수영', '필라테스', '요가', 
        '크로스핏', '클라이밍', '자전거', '등산', 
        '테니스', '골프', '기타'
    ];

    // --- 상태 관리 변수 ---
    let isFormMode = false;
    let members = []; // 원본 회원 목록
    let isLoading = true;

    // --- 폼 데이터 바인딩 변수 ---
    let editingMemberId = null;
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

    // --- [추가] 필터 및 페이지네이션 상태 변수 ---
    let filterGender = 'all';
    let filterSport = 'all';
    let filterAge = 'all';
    let currentPage = 1;
    const itemsPerPage = 10; // 페이지당 10명

    // --- 생명주기 (마운트 시 데이터 불러오기) ---
    onMount(async () => {
        await fetchMembers();
    });

    // 회원 목록 불러오기 함수
    async function fetchMembers() {
        isLoading = true;
        try {
            const q = query(collection(db, 'members'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            members = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error fetching members:", error);
            alert("회원 목록을 불러오는 데 실패했습니다.");
        } finally {
            isLoading = false;
        }
    }

    // --- [추가] Svelte 반응형 변수 (필터링 및 페이지네이션) ---

    // 1. 필터링된 회원 목록
    $: filteredMembers = members.filter(member => {
        // 성별 필터
        const genderMatch = filterGender === 'all' || member.gender === filterGender;
        
        // 주종목 필터
        const sportMatch = filterSport === 'all' || member.mainSport === filterSport;
        
        // 나이대 필터
        const ageMatch = (() => {
            if (filterAge === 'all') return true;
            const age = member.age;
            if (filterAge === '20s') return age >= 20 && age < 30;
            if (filterAge === '30s') return age >= 30 && age < 40;
            if (filterAge === 'other') return age < 20 || age >= 40;
            return true;
        })();
        
        return genderMatch && sportMatch && ageMatch;
    });

    // 2. 총 페이지 수 계산
    $: totalPages = Math.ceil(filteredMembers.length / itemsPerPage);

    // 3. 현재 페이지에 표시할 회원 목록
    $: paginatedMembers = filteredMembers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // [추가] 필터 변경 시 1페이지로 리셋
    function handleFilterChange() {
        currentPage = 1;
    }

    // [추가] 페이지네이션 함수
    function prevPage() {
        if (currentPage > 1) {
            currentPage--;
        }
    }
    function nextPage() {
        if (currentPage < totalPages) {
            currentPage++;
        }
    }

    // --- (기존 함수들: toggleMode, resetForm, handleDelete, handleEdit, 파일 처리, handleSubmit) ---
    // (이하 함수들은 이전 코드와 동일합니다)

    function toggleMode() {
        isFormMode = !isFormMode;
        if (!isFormMode) {
            resetForm();
        }
    }

    function resetForm() {
        editingMemberId = null;
        name = '';
        age = '';
        gender = '';
        mainSport = '';
        secondarySport = '';
        location = '';
        bio = '';
        existingPhotos = [];
        selectedFiles.forEach(entry => URL.revokeObjectURL(entry.url));
        selectedFiles = [];
    }

    async function handleDelete(id) {
        if (!confirm('정말로 이 회원을 삭제하시겠습니까?')) return;
        try {
            await deleteDoc(doc(db, 'members', id));
            alert('삭제되었습니다.');
            await fetchMembers(); // 목록 새로고침
        } catch (error) {
            console.error("Error deleting member:", error);
            alert("삭제 중 오류가 발생했습니다.");
        }
    }

    function handleEdit(member) {
        isFormMode = true;
        editingMemberId = member.id;
        name = member.name;
        age = member.age;
        gender = member.gender || '';
        mainSport = member.mainSport || '';
        secondarySport = member.secondarySport || '';
        location = member.location;
        bio = member.bio;
        existingPhotos = member.photos || [];
    }

    function handleFileSelect(event) {
        const newFiles = Array.from(event.target.files);
        const newEntries = newFiles.map(file => ({
            file,
            url: URL.createObjectURL(file),
            id: Math.random().toString(36).substring(2, 9)
        }));
        selectedFiles = [...selectedFiles, ...newEntries];
        event.target.value = '';
    }

    function removeNewFile(idToRemove) {
        const entryToRemove = selectedFiles.find(entry => entry.id === idToRemove);
        if (entryToRemove) {
            URL.revokeObjectURL(entryToRemove.url);
            selectedFiles = selectedFiles.filter(entry => entry.id !== idToRemove);
        }
    }

    function removeExistingPhoto(urlToRemove) {
        existingPhotos = existingPhotos.filter(url => url !== urlToRemove);
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
                        if (width > maxDim) { height *= maxDim / width; width = maxDim; }
                    } else {
                        if (height > maxDim) { width *= maxDim / height; height = maxDim; }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob(async (blob) => {
                        if (blob) resolve({ blob, ext: 'avif' });
                        else canvas.toBlob(webpBlob => resolve({ blob: webpBlob, ext: 'webp' }), 'image/webp', 0.8);
                    }, 'image/avif', 0.8);
                };
                img.onerror = (err) => reject(err);
            };
        });
    }

    async function handleSubmit() {
        if (!name || !age || !gender || !mainSport || (existingPhotos.length === 0 && selectedFiles.length === 0)) {
            alert('필수 정보(이름, 나이, 성별, 주종목)와 최소 1장 이상의 사진이 필요합니다.');
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
                const filename = `members/${timestamp}_${i}.${ext}`;
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
                updatedAt: new Date()
            };
            if (editingMemberId) {
                await updateDoc(doc(db, 'members', editingMemberId), memberData);
                alert('회원 정보가 수정되었습니다!');
            } else {
                memberData.createdAt = new Date();
                await addDoc(collection(db, 'members'), memberData);
                alert('새 회원이 등록되었습니다!');
            }
            resetForm();
            isFormMode = false;
            fetchMembers();
        } catch (error) {
            console.error('Error saving member: ', error);
            alert('저장 중 오류가 발생했습니다: ' + error.message);
        } finally {
            isUploading = false;
            uploadStatus = '';
        }
    }
</script>

<div class="admin-container">
    <div class="header-area">
        <h1>관리자 - 회원 관리</h1>
        {#if !isFormMode}
            <button class="toggle-btn primary" on:click={toggleMode}>+ 회원 등록</button>
        {:else}
            <button class="toggle-btn secondary" on:click={toggleMode} disabled={isUploading}>← 목록으로</button>
        {/if}
    </div>

    {#if isFormMode}
        <div class="form-container fade-in">
            <h2>{editingMemberId ? '회원 정보 수정' : '새 회원 등록'}</h2>
            <form on:submit|preventDefault={handleSubmit} class="member-form">
                <div class="form-group">
                    <label for="name">이름</label>
                    <input type="text" id="name" bind:value={name} required placeholder="예: 김민준" />
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
                                    <button type="button" class="remove-btn" on:click={() => removeExistingPhoto(url)}>✕</button>
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
                                    <button type="button" class="remove-btn" on:click={() => removeNewFile(entry.id)}>✕</button>
                                </div>
                            {/each}
                        </div>
                    {/if}
                    <p class="hint">* 총 {existingPhotos.length + selectedFiles.length}장의 사진이 저장됩니다.</p>
                </div>
                <button type="submit" class="submit-btn" disabled={isUploading}>
                    {isUploading ? uploadStatus : (editingMemberId ? '수정 완료' : '등록 완료')}
                </button>
            </form>
        </div>

    {:else}
        <div class="list-container fade-in">
            
            <div class="filter-area">
                <div class="filter-group">
                    <label for="filter-gender">성별</label>
                    <select id="filter-gender" bind:value={filterGender} on:change={handleFilterChange}>
                        <option value="all">전체</option>
                        <option value="남성">남성</option>
                        <option value="여성">여성</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label for="filter-sport">주종목</label>
                    <select id="filter-sport" bind:value={filterSport} on:change={handleFilterChange}>
                        <option value="all">전체</option>
                        {#each sportsList as sport}
                            <option value={sport}>{sport}</option>
                        {/each}
                    </select>
                </div>
                <div class="filter-group">
                    <label for="filter-age">나이대</label>
                    <select id="filter-age" bind:value={filterAge} on:change={handleFilterChange}>
                        <option value="all">전체</option>
                        <option value="20s">20대</option>
                        <option value="30s">30대</option>
                        <option value="other">기타</option>
                    </select>
                </div>
            </div>

            {#if isLoading}
                <p class="loading-text">데이터 불러오는 중...</p>
            {:else if members.length === 0}
                <div class="empty-list">
                    <p>등록된 회원이 없습니다.</p>
                </div>
            {:else if filteredMembers.length === 0}
                <div class="empty-list">
                    <p>필터 조건에 맞는 회원이 없습니다.</p>
                </div>
            {:else}
                <div class="member-list">
                    {#each paginatedMembers as member (member.id)}
                        <div class="member-item">
                            <div class="member-content">
                                <div class="member-photo">
                                    {#if member.photos && member.photos.length > 0}
                                        <img src={member.photos[0]} alt="{member.name}" />
                                    {:else}
                                        <div class="no-photo">No Photo</div>
                                    {/if}
                                </div>
                                <div class="member-info">
                                    <h3>{member.name} <span class="member-age">({member.age}, {member.gender})</span></h3>
                                    <p class="member-sports">
                                        {member.mainSport}
                                        {#if member.secondarySport}
                                            <span class="secondary-sport">/ {member.secondarySport}</span>
                                        {/if}
                                    </p>
                                    <p class="member-location">📍 {member.location}</p>
                                </div>
                            </div>

                            <div class="member-actions">
                                <button class="action-btn edit-btn" on:click={() => handleEdit(member)}>수정</button>
                                <button class="action-btn delete-btn" on:click={() => handleDelete(member.id)}>삭제</button>
                            </div>
                        </div>
                    {/each}
                </div>

                <div class="pagination-area">
                    <button on:click={prevPage} disabled={currentPage === 1}>
                        이전
                    </button>
                    <span>
                        페이지 {currentPage} / {totalPages} (총 {filteredMembers.length}명)
                    </span>
                    <button on:click={nextPage} disabled={currentPage === totalPages}>
                        다음
                    </button>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .admin-container {
        max-width: 800px;
        margin: 40px auto;
        padding: 20px;
        background-color: #f9f9f9;
        border-radius: 16px;
        min-height: 500px;
    }

    .header-area { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    h1 { color: #333; margin: 0; }
    h2 { margin-top: 0; color: #555; }

    .toggle-btn { padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; border: none; transition: 0.2s; }
    .toggle-btn.primary { background-color: #ff6b6b; color: white; }
    .toggle-btn.primary:hover { background-color: #e55b5b; }
    .toggle-btn.secondary { background-color: #ddd; color: #333; }
    .toggle-btn.secondary:hover { background-color: #ccc; }
    .toggle-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .fade-in { animation: fadeIn 0.3s ease-in-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    /* --- 폼 스타일 --- */
    .form-container { background: #fff; padding: 25px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
    .member-form { display: flex; flex-direction: column; gap: 20px; }
    .form-group { display: flex; flex-direction: column; gap: 8px; }

    .radio-group { display: flex; gap: 24px; padding-top: 8px; }
    .radio-group label { display: flex; align-items: center; gap: 6px; font-weight: normal; cursor: pointer; }
    input[type="radio"] { padding: 0; width: auto; height: auto; }

    label { font-weight: bold; color: #555; }
    .sub-label { font-size: 14px; color: #666; margin: 5px 0; font-weight: 600; }
    
    input[type="text"], 
    input[type="number"], 
    textarea,
    select { 
        padding: 12px; 
        border: 1px solid #ddd; 
        border-radius: 8px; 
        font-size: 16px; 
        background-color: white;
    }

    .hint { font-size: 12px; color: #888; margin: 5px 0 0 0; }
    .preview-area { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
    .preview-item { position: relative; width: 80px; height: 80px; }
    .preview-item.new-file { border: 2px solid #4ecdc4; border-radius: 10px; }
    .thumbnail { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; border: 1px solid #eee; }
    .remove-btn {
        position: absolute; top: -8px; right: -8px; width: 24px; height: 24px;
        background-color: #ff6b6b; color: white; border: 2px solid #fff; border-radius: 50%;
        display: flex; align-items: center; justify-content: center; cursor: pointer;
        font-size: 12px; font-weight: bold; padding: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .submit-btn { padding: 15px; background-color: #ff6b6b; color: white; border: none; border-radius: 8px; font-size: 18px; font-weight: bold; cursor: pointer; }
    .submit-btn:disabled { background-color: #ccc; cursor: not-allowed; }

    /* --- 목록 스타일 --- */
    .list-container { display: flex; flex-direction: column; gap: 15px; }
    .loading-text, .empty-list { text-align: center; color: #999; padding: 40px 0; font-size: 18px; }
    
    /* [추가] 필터 영역 스타일 */
    .filter-area {
        display: flex;
        flex-wrap: wrap; /* 모바일에서 줄바꿈 */
        gap: 16px;
        margin-bottom: 10px; /* 목록과의 간격 */
        padding: 16px;
        background-color: #fff;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .filter-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1; /* 동일한 너비로 */
        min-width: 120px; /* 최소 너비 */
    }
    .filter-group label {
        font-size: 13px;
        font-weight: bold;
        color: #555;
    }
    .filter-area select {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
        background-color: white;
    }

    .member-list {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }
    .member-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #fff;
        padding: 15px;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .member-content { display: flex; gap: 20px; align-items: center; flex: 1; }
    .member-photo { width: 60px; height: 60px; border-radius: 50%; overflow: hidden; flex-shrink: 0; background-color: #eee; }
    .member-photo img { width: 100%; height: 100%; object-fit: cover; }
    .no-photo { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #999; font-size: 10px; }
    .member-info h3 { margin: 0 0 4px 0; font-size: 18px; }
    .member-age { font-weight: normal; font-size: 15px; color: #666; }
    .member-sports { margin: 4px 0; font-size: 14px; font-weight: bold; color: #ff6b6b; }
    .secondary-sport { font-weight: normal; color: #555; }
    .member-location { margin: 0; color: #888; font-size: 14px; }
    .member-actions { display: flex; gap: 8px; }
    .action-btn {
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        font-weight: bold;
        transition: 0.2s;
    }
    .edit-btn { background-color: #f0f0f0; color: #333; }
    .edit-btn:hover { background-color: #e0e0e0; }
    .delete-btn { background-color: #ffe5e5; color: #d63031; }
    .delete-btn:hover { background-color: #ffcccc; }

    /* [추가] 페이지네이션 스타일 */
    .pagination-area {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 16px;
        margin-top: 10px;
        padding: 10px;
    }
    .pagination-area button {
        padding: 8px 16px;
        border: 1px solid #ddd;
        background-color: #fff;
        color: #333;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        transition: background-color 0.2s;
    }
    .pagination-area button:hover:not(:disabled) {
        background-color: #f9f9f9;
    }
    .pagination-area button:disabled {
        background-color: #f5f5f5;
        color: #ccc;
        cursor: not-allowed;
    }
    .pagination-area span {
        font-size: 14px;
        color: #666;
    }
</style>