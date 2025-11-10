<script>
    import { onMount, onDestroy } from 'svelte';
    import { db, auth, storage } from '$lib/firebase';
    import { collection, getDocs, query, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';
    import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
    import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

    // 운동 종목 리스트
    const sportsList = [
        '헬스', '러닝', '수영', '필라테스', '요가', 
        '크로스핏', '클라이밍', '자전거', '등산', 
        '테니스', '골프', '기타'
    ];

    // --- 로그인 사용자 정보 ---
    let currentUser = null; 
    let defaultAvatar = 'https://placehold.co/100x100/indigo/white?text=ME';

    // --- 상태 관리 변수 ---
    let recommendations = [];
    let isLoading = true;
    let currentProfileIndex = 0;
    let currentPhotoIndex = 0;
    
    // --- 모달 상태 변수 ---
    let showLoginModal = false;
    let showSettingsModal = false;
    let showCreateProfileModal = false;

    // --- 프로필 생성/수정 폼 변수 ---
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

    // --- Firebase 인증 상태 감지 ---
    let unsubscribeAuth;
    onMount(async () => {
        unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // 1. 기본 auth 정보 저장
                currentUser = {
                    name: user.displayName,
                    email: user.email,
                    avatar: user.photoURL || defaultAvatar,
                    uid: user.uid
                };
                showLoginModal = false;

                // 2. Firestore에서 'members' 프로필 정보 조회 (UID 기준)
                const userProfileRef = doc(db, 'members', user.uid);
                const userProfileSnap = await getDoc(userProfileRef);

                if (!userProfileSnap.exists()) {
                    // 3-A. 프로필이 없으면: 생성 모달 띄우고 폼 자동 채우기
                    name = currentUser.name;
                    age = '';
                    gender = '';
                    mainSport = '';
                    secondarySport = '';
                    location = '';
                    bio = '';
                    existingPhotos = currentUser.avatar ? [currentUser.avatar] : [];
                    selectedFiles = [];
                    
                    showCreateProfileModal = true;
                } else {
                    // 3-B. 프로필이 있으면: currentUser 객체에 프로필 정보 추가
                    currentUser.profile = userProfileSnap.data();
                }

            } else {
                // 로그아웃 상태
                currentUser = null;
            }
        });

        await fetchRecommendations();
    });

    onDestroy(() => {
        if (unsubscribeAuth) unsubscribeAuth();
    });

    // --- [수정] 프로필 생성/수정 폼 핸들러 (이름 변경) ---
    async function handleSubmitProfile() {
        if (!age || !gender || !mainSport || (existingPhotos.length === 0 && selectedFiles.length === 0)) {
            alert('나이, 성별, 주종목 및 1장 이상의 사진은 필수입니다.');
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
                const filename = `members/${currentUser.uid}_${timestamp}_${i}.${ext}`;
                const storageRef = ref(storage, filename);
                const snapshot = await uploadBytes(storageRef, blob);
                const downloadURL = await getDownloadURL(snapshot.ref);
                newPhotoUrls.push(downloadURL);
            }
            const finalPhotos = [...existingPhotos, ...newPhotoUrls];
            uploadStatus = '데이터 저장 중...';

            // [수정] 저장할 데이터 (createdAt은 merge 옵션으로 자동 보존)
            const memberData = {
                name: name,
                age: parseInt(age),
                gender: gender,
                mainSport: mainSport,
                secondarySport: secondarySport,
                location: location,
                bio: bio,
                photos: finalPhotos,
                email: currentUser.email,
                updatedAt: new Date()
            };

            // [수정] setDoc에 { merge: true } 옵션 추가
            // -> 문서가 없으면 생성 (createdAt 포함)
            // -> 문서가 있으면 병합 (createdAt 보존, updatedAt 등 덮어쓰기)
            if (!currentUser.profile) { // 생성 시에만 createdAt 추가
                 memberData.createdAt = new Date();
            }
            await setDoc(doc(db, 'members', currentUser.uid), memberData, { merge: true });

            // [수정] 완료 메시지 분기 처리
            if (currentUser.profile) {
                alert('프로필이 수정되었습니다!');
            } else {
                alert('프로필 생성이 완료되었습니다! FitMeet에 오신 것을 환영합니다.');
            }
            
            currentUser.profile = { ...currentUser.profile, ...memberData }; // 로컬 데이터 갱신
            showCreateProfileModal = false;
        } catch (error) {
            console.error('Error saving profile: ', error);
            alert('프로필 저장 중 오류가 발생했습니다: ' + error.message);
        } finally {
            isUploading = false;
            uploadStatus = '';
        }
    }

    // --- [추가] 프로필 수정 버튼 핸들러 ---
    function handleEditProfile() {
        const profile = currentUser.profile;
        if (!profile) {
            alert("오류: 프로필 정보가 없습니다.");
            return;
        }

        // 폼 변수에 현재 프로필 정보 채우기
        name = currentUser.name; // Google 이름 (disabled)
        age = profile.age;
        gender = profile.gender;
        mainSport = profile.mainSport;
        secondarySport = profile.secondarySport || '';
        location = profile.location || '';
        bio = profile.bio || '';
        existingPhotos = profile.photos || [];
        selectedFiles = []; // 새 파일 선택 초기화

        // 모달 전환
        showSettingsModal = false;
        showCreateProfileModal = true;
    }

    // --- 로그인/로그아웃 핸들러 (기존) ---
    async function handleGoogleLogin() {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Google login error:", error);
            alert("로그인에 실패했습니다.");
        }
    }

    async function handleLogout() {
        try {
            await signOut(auth);
            showSettingsModal = false;
            alert("로그아웃되었습니다.");
        } catch (error) {
            console.error("Logout error:", error);
            alert("로그아웃 중 오류가 발생했습니다.");
        }
    }

    // --- 모달 핸들러 (기존) ---
    function handleProfileClick() {
        if (currentUser) {
            if (!currentUser.profile && showCreateProfileModal) {
                return; 
            }
            showSettingsModal = true;
        } else {
            showLoginModal = true;
        }
    }

    function closeModals() {
        showLoginModal = false;
        showSettingsModal = false;
        showCreateProfileModal = false;
    }

    // --- Firestore 데이터 로딩 (기존) ---
    async function fetchRecommendations() {
        isLoading = true;
        try {
            const q = query(collection(db, 'members'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            recommendations = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error("Error fetching recommendations:", error);
        } finally {
            isLoading = false;
        }
    }

    // --- Svelte 반응형 선언 ($:) ---
    // 성별 필터링 로직 (기존)
    $: displayRecommendations = recommendations.filter(member => {
        if (!currentUser || !currentUser.profile) {
            return false;
        }
        if (member.id === currentUser.uid) {
            return false;
        }
        if (currentUser.profile.gender === '남성') {
            return member.gender === '여성';
        }
        if (currentUser.profile.gender === '여성') {
            return member.gender === '남성';
        }
        return false;
    });

    $: currentProfile = displayRecommendations[currentProfileIndex];
    $: currentPhoto = currentProfile ? currentProfile.photos[currentPhotoIndex] : null;

    // --- 이벤트 핸들러 함수 (기존) ---
    function nextProfile() {
        if (currentProfileIndex < displayRecommendations.length - 1) {
            currentProfileIndex++;
            currentPhotoIndex = 0;
        } else {
            alert('오늘의 추천이 끝났습니다! 내일 다시 확인해주세요.');
        }
    }
    function prevPhoto() {
        if (currentPhotoIndex > 0) currentPhotoIndex--;
    }
    function nextPhoto() {
        if (currentProfile && currentPhotoIndex < currentProfile.photos.length - 1) currentPhotoIndex++;
    }

    // --- 파일 처리 로직 (기존) ---
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

</script>

<div class="app-container">

    <header class="app-header">
        <h1 class="logo">fitmeet</h1>
        <button class="user-profile-btn" aria-label="내 프로필" on:click={handleProfileClick}>
            <img src={currentUser ? currentUser.avatar : defaultAvatar} alt="내 프로필 사진" class="user-avatar" />
        </button>
    </header>

    <main class="main-content">
        {#if isLoading}
            <div class="empty-state"><p>추천 상대를 불러오는 중입니다...</p></div>
        {:else if currentProfile}
            <div class="profile-card">
                <div class="photo-area">
                    <img src={currentPhoto} alt="{currentProfile.name} 사진" class="main-photo" />
                    <div class="indicators">
                        {#each currentProfile.photos as _, i}
                            <div class="indicator-bar {i === currentPhotoIndex ? 'active' : ''}"></div>
                        {/each}
                    </div>
                    <div class="tap-areas">
                        <button class="tap-left" on:click|stopPropagation={prevPhoto} aria-label="이전 사진"></button>
                        <button class="tap-right" on:click|stopPropagation={nextPhoto} aria-label="다음 사진"></button>
                    </div>
                </div>
                <div class="info-area">
                    <div class="name-age">
                        <h2>{currentProfile.name}</h2>
                        <span class="age">{currentProfile.age}, {currentProfile.gender}</span>
                    </div>
                     {#if currentProfile.mainSport}
                    <p class="sports">
                        <span class="main-sport">{currentProfile.mainSport}</span>
                        {#if currentProfile.secondarySport}
                            <span class="secondary-sport">/ {currentProfile.secondarySport}</span>
                        {/if}
                    </p>
                    {/if}
                    <p class="location">📍 {currentProfile.location}</p>
                    <p class="bio">{currentProfile.bio}</p>
                </div>
            </div>
            <div class="action-buttons">
                <button class="btn-pass" on:click={nextProfile}>PASS</button>
                <button class="btn-like" on:click={nextProfile}>LIKE</button>
            </div>
        {:else}
            <div class="empty-state">
                {#if !currentUser || !currentUser.profile}
                    <p>로그인 및 프로필 생성을<br>완료해주세요.</p>
                {:else}
                    <p>더 이상 추천할 회원이 없습니다.</p>
                {/if}
            </div>
        {/if}
    </main>

    {#if showLoginModal}
        <div class="modal-overlay" on:click={closeModals}>
            <div class="modal-content" on:click|stopPropagation>
                <h2>로그인</h2>
                <p>FitMeet에 오신 것을 환영합니다!<br>더 많은 기능을 위해 로그인해주세요.</p>
                <button class="google-login-btn" on:click={handleGoogleLogin}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
                    구글 계정으로 시작하기
                </button>
                <button class="close-modal-btn" on:click={closeModals}>닫기</button>
            </div>
        </div>
    {/if}

    {#if showSettingsModal && currentUser}
        <div class="modal-overlay" on:click={closeModals}>
            <div class="modal-content" on:click|stopPropagation>
                <h2>내 프로필</h2>
                <div class="user-info">
                    <img src={currentUser.avatar} alt="내 프로필 사진" class="modal-avatar" />
                    <div class="user-details">
                        <h3>{currentUser.name}</h3>
                        <p>{currentUser.email}</p>
                    </div>
                </div>
                <div class="modal-actions">
                    <button class="edit-profile-btn" on:click={handleEditProfile}>프로필 수정</button>
                    <button class="logout-btn" on:click={handleLogout}>로그아웃</button>
                </div>
                <button class="close-modal-btn" on:click={closeModals}>닫기</button>
            </div>
        </div>
    {/if}

    {#if showCreateProfileModal}
        <div class="modal-overlay"> 
            <div class="modal-content form-modal" on:click|stopPropagation>
                <h2>{currentUser.profile ? '프로필 수정' : '프로필 생성'}</h2>
                <p>FitMeet을 시작하기 위해<br>추가 정보를 입력해주세요.</p>
                
                <form on:submit|preventDefault={handleSubmitProfile} class="member-form">
                    <div class="form-group">
                        <label for="name">이름</label>
                        <input type="text" id="name" bind:value={name} required disabled />
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
                        {isUploading ? uploadStatus : (currentUser.profile ? '수정 완료' : '생성 완료')}
                    </button>
                </form>
                
                 {#if !currentUser.profile}
                    <button class="close-modal-btn" on:click={closeModals}>나중에 하기</button>
                 {:else}
                    <button class="close-modal-btn" on:click={closeModals}>닫기</button>
                 {/if}
            </div>
        </div>
    {/if}

</div>

<style>
    /* :global(body) ~ .empty-state (기존 스타일) */
    :global(body) { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; background-color: #f5f7fa; color: #333; }
    .app-container { max-width: 500px; height: 100dvh; margin: 0 auto; background-color: #fff; display: flex; flex-direction: column; box-shadow: 0 0 20px rgba(0,0,0,0.05); position: relative; }
    .app-header { height: 60px; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; border-bottom: 1px solid #eee; }
    .logo { font-size: 24px; font-weight: 800; color: #ff6b6b; margin: 0; letter-spacing: -0.5px; }
    .user-profile-btn { background: none; border: none; padding: 0; cursor: pointer; }
    .user-avatar { width: 36px; height: 36px; border-radius: 50%; border: 2px solid #eee; object-fit: cover; }
    .main-content { flex: 1; padding: 16px; display: flex; flex-direction: column; overflow: hidden; }
    .profile-card { flex: 1; display: flex; flex-direction: column; border-radius: 16px; overflow: hidden; background-color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.08); margin-bottom: 20px; position: relative; }
    .photo-area { aspect-ratio: 1; position: relative; background-color: #eee; overflow: hidden; width: 100%; }
    .main-photo { width: 100%; height: 100%; object-fit: cover; }
    .indicators { position: absolute; top: 8px; left: 8px; right: 8px; display: flex; gap: 4px; z-index: 10; }
    .indicator-bar { flex: 1; height: 4px; background-color: rgba(0, 0, 0, 0.2); border-radius: 2px; }
    .indicator-bar.active { background-color: #fff; }
    .tap-areas { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; }
    .tap-left, .tap-right { flex: 1; opacity: 0; cursor: pointer; }
    .info-area { padding: 20px; background: #fff; flex: 1; overflow: auto; }
    .name-age { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
    .name-age h2 { margin: 0; font-size: 26px; }
    .age { font-size: 22px; font-weight: normal; }
    .sports { margin: -4px 0 10px 0; font-size: 15px; }
    .main-sport { font-weight: bold; color: #ff6b6b; }
    .secondary-sport { color: #555; }
    .location { color: #666; margin: 0 0 12px 0; font-size: 14px; }
    .bio { margin: 0; font-size: 16px; line-height: 1.5; color: #444; word-break: keep-all; }
    .action-buttons { display: flex; justify-content: center; gap: 20px; margin-bottom: 10px; }
    .btn-pass, .btn-like { width: 64px; height: 64px; border-radius: 50%; border: none; font-weight: bold; font-size: 14px; cursor: pointer; transition: transform 0.1s ease; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
    .btn-pass:active, .btn-like:active { transform: scale(0.95); }
    .btn-pass { background-color: #fff; color: #ff6b6b; border: 2px solid #ff6b6b; }
    .btn-like { background-color: #fff; color: #4ecdc4; border: 2px solid #4ecdc4; }
    .empty-state { flex: 1; display: flex; justify-content: center; align-items: center; color: #999; font-size: 18px; text-align: center; line-height: 1.6; }

    /* 모달 스타일 (기존) */
    .modal-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.5); display: flex; justify-content: center; align-items: center; z-index: 100; }
    .modal-content { background-color: #fff; padding: 30px; border-radius: 16px; width: 80%; max-width: 320px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.15); animation: slideUp 0.3s ease-out; }
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .modal-content h2 { margin-top: 0; color: #333; }
    .modal-content p { color: #666; margin-bottom: 24px; line-height: 1.5; }
    .google-login-btn { width: 100%; padding: 12px; background-color: #fff; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; font-weight: 500; color: #555; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; transition: background-color 0.2s; margin-bottom: 12px; }
    .google-login-btn:hover { background-color: #f5f5f5; }
    .close-modal-btn { background: none; border: none; color: #999; font-size: 14px; cursor: pointer; padding: 8px; text-decoration: underline; }
    .user-info { display: flex; flex-direction: column; align-items: center; margin-bottom: 24px; }
    .modal-avatar { width: 80px; height: 80px; border-radius: 50%; margin-bottom: 12px; object-fit: cover; border: 3px solid #eee; }
    .user-details h3 { margin: 0 0 4px 0; font-size: 20px; }
    .user-details p { margin: 0; color: #888; font-size: 14px; }
    
    /* [수정] 모달 액션 버튼 영역 */
    .modal-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 100%;
        margin-bottom: 10px; /* 닫기 버튼과의 간격 */
    }
    
    /* [추가] 프로필 수정 버튼 스타일 */
    .edit-profile-btn {
        width: 100%;
        padding: 12px;
        background-color: #f0f0f0;
        color: #333;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    .edit-profile-btn:hover { background-color: #e0e0e0; }

    .logout-btn { width: 100%; padding: 12px; background-color: #ffe5e5; color: #d63031; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; }

    /* 프로필 생성 폼 모달 스타일 (기존) */
    .modal-content.form-modal { max-height: 80dvh; overflow-y: auto; text-align: left; }
    .member-form { display: flex; flex-direction: column; gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .radio-group { display: flex; gap: 20px; padding-top: 4px; }
    .radio-group label { display: flex; align-items: center; gap: 6px; font-weight: normal; cursor: pointer; }
    input[type="radio"] { padding: 0; width: auto; height: auto; }
    label { font-weight: bold; color: #555; font-size: 14px; }
    .sub-label { font-size: 13px; color: #666; margin: 4px 0; font-weight: 600; }
    input[type="text"], input[type="number"], textarea, select { padding: 10px; border: 1px solid #ddd; border-radius: 8px; font-size: 15px; background-color: white; }
    input[type="text"]:disabled { background-color: #f5f5f5; color: #888; }
    .hint { font-size: 12px; color: #888; margin: 0; }
    .preview-area { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
    .preview-item { position: relative; width: 70px; height: 70px; }
    .preview-item.new-file { border: 2px solid #4ecdc4; border-radius: 10px; }
    .thumbnail { width: 100%; height: 100%; object-fit: cover; border-radius: 8px; border: 1px solid #eee; }
    .remove-btn { position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; background-color: #ff6b6b; color: white; border: 2px solid #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 10px; font-weight: bold; padding: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
    .submit-btn { padding: 14px; background-color: #ff6b6b; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; margin-top: 10px; }
    .submit-btn:disabled { background-color: #ccc; cursor: not-allowed; }
</style>