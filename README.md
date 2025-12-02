# 🏋️‍♂️ FitMeet (핏밋) - 운동 파트너 매칭 서비스

![Svelte](https://img.shields.io/badge/Svelte-4A4A55?style=for-the-badge&logo=svelte&logoColor=FF3E00)
![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Project Banner](/static/screenshot2.jpg)

> **"나와 딱 맞는 운동 메이트를 찾아보세요!"** > FitMeet은 사용자의 위치, 주 종목, 나이 등을 기반으로 최적의 운동 파트너를 추천해 주는 PWA 기반 웹 애플리케이션입니다.

## ✨ 주요 기능 (Key Features)

### 1. 사용자 매칭 (Matching)
- **Tinder 스타일 UI:** 카드를 좌우로 스와이프하여 `LIKE`(좋아요) 또는 `PASS`(넘기기)를 할 수 있습니다. (Swiper.js 활용)
- **상호 매칭:** 서로 `LIKE`를 보낸 경우에만 매칭이 성사되어 채팅이 가능합니다.
- **알고리즘:** 성별, 이미 매칭된 사용자 제외 등 필터링 로직을 통해 추천 목록을 제공합니다.

### 2. 실시간 채팅 (Real-time Chat)
- **Firestore 연동:** 매칭된 사용자와 실시간으로 메시지를 주고받을 수 있습니다.
- **읽음 확인:** 상대방이 메시지를 읽었는지 실시간으로 확인 가능합니다.
- **필터링:** 비속어, 개인정보(전화번호 등) 전송 시 자동으로 필터링 및 차단됩니다.

### 3. PWA & 푸시 알림 (Web Push)
- **설치형 앱:** 모바일 및 데스크탑에 앱처럼 설치하여 사용할 수 있습니다.
- **FCM 연동:** 새로운 `LIKE`, 매칭 성사, 새 메시지 도착 시 푸시 알림을 발송합니다. (Service Worker)

### 4. 관리자 대시보드 (Admin)
- **대시보드:** 전체 회원 수, 매칭 수, 방문자 수 등 주요 지표를 시각화합니다.
- **회원 관리:** 가입된 회원 목록 조회, 수정, 삭제가 가능합니다.
- **설정 관리:** 운동 종목 추가/삭제 및 채팅 금칙어(필터링)를 관리할 수 있습니다.

---

## 🛠 기술 스택 (Tech Stack)

| 구분 | 기술 |
| --- | --- |
| **Frontend** | SvelteKit (Svelte 5), Vite |
| **Backend** | Firebase (Authentication, Firestore, Storage, Cloud Functions, Messaging) |
| **Style** | CSS (Scoped), Swiper.js (UI Interactions) |
| **Deployment** | Vercel (Frontend), Firebase Cloud Functions (Backend Logic) |

---

## 🚀 시작하기 (Getting Started)

이 프로젝트를 로컬 환경에서 실행하려면 다음 단계가 필요합니다.

### 1. 레포지토리 클론
```bash
git clone [https://github.com/your-username/fitmeet.git](https://github.com/your-username/fitmeet.git)
cd fitmeet
2. 의존성 설치Bashnpm install
3. 환경 변수 설정 (.env)프로젝트 루트에 .env 파일을 생성하고 Firebase 설정 값을 입력하세요.코드 스니펫VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_VAPID_KEY=your_fcm_vapid_key
4. 개발 서버 실행Bashnpm run dev
브라우저에서 http://localhost:5173으로 접속하여 확인합니다.📂 프로젝트 구조 (Structure)fitmeet/
├── functions/          # Firebase Cloud Functions (백엔드 로직)
├── src/
│   ├── lib/
│   │   ├── components/ # 재사용 가능한 Svelte 컴포넌트 (모달, 카드 등)
│   │   └── firebase.js # Firebase 초기화 설정
│   ├── routes/         # 페이지 라우팅 (SvelteKit)
│   │   ├── admin/      # 관리자 페이지
│   │   ├── chat/       # 채팅방 페이지
│   │   ├── likes/      # 받은 좋아요 목록
│   │   ├── matches/    # 매칭된 목록
│   │   └── +page.svelte # 메인(스와이프) 페이지
│   ├── service-worker.js # PWA 및 푸시 알림 처리
│   └── app.html
└── static/             # 정적 이미지 및 manifest.json