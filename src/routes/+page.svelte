<script>
    // --- Mock Data 영역 ---
    // 현재 로그인한 사용자 (헤더 표시용)
    let currentUser = {
        name: '내 프로필',
        avatar: 'https://placehold.co/100x100/indigo/white?text=ME'
    };

    // 매칭 추천 상대 리스트 Mock Data
    let recommendations = [
        {
            id: 1,
            name: '김민준',
            age: 28,
            location: '강남구 역삼동',
            bio: '퇴근 후 러닝을 즐겨합니다. 주말엔 등산도 좋아요! 🏃‍♂️⛰️',
            photos: [
                '/images/man1-1.jpg',
                '/images/man1-2.jpg',
            ]
        },
        {
            id: 2,
            name: '이서연',
            age: 26,
            location: '마포구 서교동',
            bio: '헬스장 메이트 구해요. 맛집 탐방도 같이 가실 분?',
            photos: [
                '/images/woman1-1.jpg',
                '/images/woman1-2.jpg',
                '/images/woman1-3.jpg'
            ]
        },
        {
            id: 3,
            name: '박지훈',
            age: 31,
            location: '송파구 잠실동',
            bio: '자전거 라이딩 함께 하실 분 찾습니다 🚴',
            photos: [
                '/images/man2-1.jpg'
            ]
        }
    ];

    // --- 상태 관리 변수 ---
    let currentProfileIndex = 0; // 현재 보고 있는 사람의 인덱스
    let currentPhotoIndex = 0;   // 현재 보고 있는 사진의 인덱스

    // Svelte 반응형 선언 ($:)
    // 인덱스가 바뀔 때마다 현재 프로필과 사진 데이터를 자동으로 업데이트합니다.
    $: currentProfile = recommendations[currentProfileIndex];
    $: currentPhoto = currentProfile ? currentProfile.photos[currentPhotoIndex] : null;

    // --- 이벤트 핸들러 함수 ---

    // 다음 사람으로 넘기기 (PASS/LIKE 공통)
    function nextProfile() {
        if (currentProfileIndex < recommendations.length - 1) {
            currentProfileIndex++;
            currentPhotoIndex = 0; // 새 프로필은 첫 번째 사진부터
        } else {
            alert('오늘의 추천이 끝났습니다! 내일 다시 확인해주세요.');
        }
    }

    // 이전 사진 보기
    function prevPhoto() {
        if (currentPhotoIndex > 0) {
            currentPhotoIndex--;
        }
    }

    // 다음 사진 보기
    function nextPhoto() {
        if (currentProfile && currentPhotoIndex < currentProfile.photos.length - 1) {
            currentPhotoIndex++;
        }
    }
</script>

<!-- 화면 레이아웃 -->
<div class="app-container">

    <!-- 1. 헤더 영역 -->
    <header class="app-header">
        <h1 class="logo">fitmeet</h1>
        <button class="user-profile-btn" aria-label="내 프로필">
            <img src={currentUser.avatar} alt="내 프로필 사진" class="user-avatar" />
        </button>
    </header>

    <!-- 2. 메인 컨텐츠 영역 -->
    <main class="main-content">
        {#if currentProfile}
            <!-- 프로필 카드 -->
            <div class="profile-card">
                <!-- 사진 슬라이더 영역 -->
                <div class="photo-area">
                    <img src={currentPhoto} alt="{currentProfile.name} 사진" class="main-photo" />

                    <!-- 상단 사진 인디케이터 바 -->
                    <div class="indicators">
                        {#each currentProfile.photos as _, i}
                            <!-- 현재 보고 있는 사진 인덱스와 같으면 active 클래스 추가 -->
                            <div class="indicator-bar {i === currentPhotoIndex ? 'active' : ''}"></div>
                        {/each}
                    </div>

                    <!-- 사진 넘기기 터치 영역 (투명 버튼) -->
                    <div class="tap-areas">
                        <button class="tap-left" on:click|stopPropagation={prevPhoto} aria-label="이전 사진"></button>
                        <button class="tap-right" on:click|stopPropagation={nextPhoto} aria-label="다음 사진"></button>
                    </div>
                </div>

                <!-- 정보 영역 -->
                <div class="info-area">
                    <div class="name-age">
                        <h2>{currentProfile.name}</h2>
                        <span class="age">{currentProfile.age}</span>
                    </div>
                    <p class="location">📍 {currentProfile.location}</p>
                    <p class="bio">{currentProfile.bio}</p>
                </div>
            </div>

            <!-- 하단 액션 버튼 -->
            <div class="action-buttons">
                <button class="btn-pass" on:click={nextProfile}>
                    PASS
                    <!-- (실제 앱에서는 아이콘 사용 추천) ✕ -->
                </button>
                <button class="btn-like" on:click={nextProfile}>
                    LIKE
                    <!-- (실제 앱에서는 아이콘 사용 추천) ♥ -->
                </button>
            </div>

        {:else}
            <!-- 추천이 끝났을 때 표시 -->
            <div class="empty-state">
                <p>더 이상 추천할 회원이 없습니다.</p>
            </div>
        {/if}
    </main>
</div>

<style>
    /* 전역 스타일 초기화 (간단하게) */
    :global(body) {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
        background-color: #f5f7fa;
        color: #333;
    }

    /* 앱 전체 컨테이너: 모바일 뷰처럼 중앙 정렬 */
    .app-container {
        max-width: 500px; /* 모바일 화면 폭 제한 */
        height: 100dvh;   /* 모바일 브라우저 주소창 대응 높이 */
        margin: 0 auto;
        background-color: #fff;
        display: flex;
        flex-direction: column;
        box-shadow: 0 0 20px rgba(0,0,0,0.05);
    }

    /* --- 헤더 스타일 --- */
    .app-header {
        height: 60px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 20px;
        border-bottom: 1px solid #eee;
    }

    .logo {
        font-size: 24px;
        font-weight: 800;
        color: #ff6b6b; /* fitmeet 브랜드 컬러(예시) */
        margin: 0;
        letter-spacing: -0.5px;
    }

    .user-profile-btn {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
    }

    .user-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 2px solid #eee;
        object-fit: cover;
    }

    /* --- 메인 컨텐츠 스타일 --- */
    .main-content {
        flex: 1;
        padding: 16px;
        display: flex;
        flex-direction: column;
        overflow: hidden; /* 스크롤 방지 */
    }

    .profile-card {
        flex: 1;
        display: flex;
        flex-direction: column;
        border-radius: 16px;
        overflow: hidden;
        background-color: #fff;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        margin-bottom: 20px;
        position: relative; /* 인디케이터 등을 위해 */
    }

    /* 사진 영역 */
    .photo-area {
        flex: 2; /* 정보 영역보다 더 넓게 차지 */
        position: relative;
        background-color: #eee;
        overflow: hidden;
    }

    .main-photo {
        width: 100%;
        height: 100%;
        object-fit: cover; /* 비율 유지하며 꽉 채우기 */
    }

    /* 사진 인디케이터 바 */
    .indicators {
        position: absolute;
        top: 8px;
        left: 8px;
        right: 8px;
        display: flex;
        gap: 4px;
        z-index: 10;
    }

    .indicator-bar {
        flex: 1;
        height: 4px;
        background-color: rgba(0, 0, 0, 0.2);
        border-radius: 2px;
    }

    .indicator-bar.active {
        background-color: #fff; /* 현재 보는 사진은 흰색으로 강조 */
    }

    /* 사진 넘기기 터치 영역 */
    .tap-areas {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        display: flex;
    }
    .tap-left, .tap-right {
        flex: 1;
        opacity: 0; /* 투명하게 */
        cursor: pointer;
    }

    /* 정보 영역 */
    .info-area {
        padding: 20px;
        background: #fff;
    }

    .name-age {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 8px;
    }
    .name-age h2 {
        margin: 0;
        font-size: 26px;
    }
    .age {
        font-size: 22px;
        font-weight: normal;
    }

    .location {
        color: #666;
        margin: 0 0 12px 0;
        font-size: 14px;
    }

    .bio {
        margin: 0;
        font-size: 16px;
        line-height: 1.5;
        color: #444;
        word-break: keep-all; /* 한글 줄바꿈 개선 */
    }

    /* 하단 액션 버튼 */
    .action-buttons {
        display: flex;
        justify-content: center;
        gap: 20px;
        margin-bottom: 10px;
    }

    .btn-pass, .btn-like {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        border: none;
        font-weight: bold;
        font-size: 14px;
        cursor: pointer;
        transition: transform 0.1s ease;
        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    }
    .btn-pass:active, .btn-like:active {
        transform: scale(0.95); /* 클릭 시 살짝 작아지는 효과 */
    }

    .btn-pass {
        background-color: #fff;
        color: #ff6b6b;
        border: 2px solid #ff6b6b;
    }
    .btn-like {
        background-color: #fff;
        color: #4ecdc4;
        border: 2px solid #4ecdc4;
    }

    .empty-state {
        flex: 1;
        display: flex;
        justify-content: center;
        align-items: center;
        color: #999;
        font-size: 18px;
    }
</style>