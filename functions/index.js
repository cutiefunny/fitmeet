/**
 * Firebase Cloud Functions (Callable Function)
 */

// HttpsError를 'firebase-functions/v2/https'에서 함께 임포트합니다.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Firebase Admin SDK 초기화
initializeApp();
const db = getFirestore();

/**
 * 배열을 무작위로 섞는 헬퍼 함수 (Fisher-Yates Shuffle)
 * @param {Array<any>} array - 셔플할 배열
 * @returns {Array<any>} 셔플된 배열
 */
function shuffleArray(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

exports.getRecommendations = onCall(async (request) => {
	// 1. 인증 확인 (필수)
	if (!request.auth) {
		// 'functions.https.HttpsError' 대신 임포트한 'HttpsError'를 사용합니다.
		throw new HttpsError(
			"unauthenticated",
			"The function must be called while authenticated."
		);
	}

	const myUid = request.auth.uid;

	try {
		// 2. 요청한 사용자(나)의 프로필 조회
		const myProfileRef = db.collection("members").doc(myUid);
		const myProfileSnap = await myProfileRef.get();

		if (!myProfileSnap.exists) {
			// HttpsError 사용
			throw new HttpsError(
				"not-found",
				"User profile does not exist."
			);
		}

		const myProfile = myProfileSnap.data();
		const myGender = myProfile.gender;
		const myMatchedUids = myProfile.matched || [];
		
		// 3. 필터링할 제외 목록 생성 (본인 + 이미 매치된 상대)
		const exclusionSet = new Set([myUid, ...myMatchedUids]);

		// 4. 타겟 성별 결정
		const targetGender = myGender === "남성" ? "여성" : "남성";

		// 5. DB 쿼리 (1차 필터링: 성별)
		const q = db.collection("members").where("gender", "==", targetGender);
		const querySnapshot = await q.get();

		const allTargetMembers = [];
		querySnapshot.forEach((doc) => {
			allTargetMembers.push({ id: doc.id, ...doc.data() });
		});

		// 6. 서버에서 2차 필터링 (제외 목록)
		const filteredMembers = allTargetMembers.filter(
			(member) => !exclusionSet.has(member.id)
		);

		// 7. 셔플 및 잘라내기
		const shuffledMembers = shuffleArray(filteredMembers);
		const finalRecommendations = shuffledMembers.slice(0, 50); // 최대 50명만 반환

		return finalRecommendations;

	} catch (error) {
		console.error("Error fetching recommendations:", error);
		// HttpsError 사용 (이미 HttpsError인 경우는 그대로 throw)
		if (error instanceof HttpsError) {
			throw error;
		}
		throw new HttpsError(
			"internal",
			"Failed to get recommendations."
		);
	}
});