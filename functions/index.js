/**
 * Firebase Cloud Functions
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentDeleted, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

/**
 * (기존) 배열 셔플 함수
 */
function shuffleArray(array) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
}

/**
 * (기존) 추천 목록 Cloud Function
 */
exports.getRecommendations = onCall(async (request) => {
	// ... (기존 코드와 동일)
	if (!request.auth) {
		throw new HttpsError(
			"unauthenticated",
			"The function must be called while authenticated."
		);
	}
	const myUid = request.auth.uid;
	try {
		const myProfileRef = db.collection("members").doc(myUid);
		const myProfileSnap = await myProfileRef.get();
		if (!myProfileSnap.exists) {
			throw new HttpsError("not-found", "User profile does not exist.");
		}
		const myProfile = myProfileSnap.data();
		const myGender = myProfile.gender;
		const myMatchedUids = myProfile.matched || [];
		const exclusionSet = new Set([myUid, ...myMatchedUids]);
		const targetGender = myGender === "남성" ? "여성" : "남성";
		const q = db.collection("members").where("gender", "==", targetGender);
		const querySnapshot = await q.get();
		const allTargetMembers = [];
		querySnapshot.forEach((doc) => {
			allTargetMembers.push({ id: doc.id, ...doc.data() });
		});
		const filteredMembers = allTargetMembers.filter(
			(member) => !exclusionSet.has(member.id)
		);
		const shuffledMembers = shuffleArray(filteredMembers);
		const finalRecommendations = shuffledMembers.slice(0, 50);
		return finalRecommendations;
	} catch (error) {
		console.error("Error fetching recommendations:", error);
		if (error instanceof HttpsError) {
			throw error;
		}
		throw new HttpsError("internal", "Failed to get recommendations.");
	}
});

/**
 * (기존) 채팅방 삭제 시 메시지 삭제 Trigger
 */
exports.onChatRoomDeleted = onDocumentDeleted("chats/{chatId}", async (event) => {
	// ... (기존 코드와 동일)
	const chatId = event.params.chatId;
	logger.log(`[ChatCleanup] Deleting messages for chatroom: ${chatId}`);
	const collectionRef = db.collection("chats").doc(chatId).collection("messages");
	const batchSize = 500;
	try {
		let snapshot = await collectionRef.limit(batchSize).get();
		while (snapshot.size > 0) {
			const batch = db.batch();
			snapshot.docs.forEach((doc) => {
				batch.delete(doc.ref);
			});
			await batch.commit();
			logger.log(
				`[ChatCleanup] Deleted ${snapshot.size} messages from chatroom: ${chatId}`
			);
			snapshot = await collectionRef.limit(batchSize).get();
		}
		logger.log(
			`[ChatCleanup] All messages deleted successfully for chatroom: ${chatId}`
		);
		return null;
	} catch (error) {
		logger.error(
			`[ChatCleanup] Error deleting messages for chatroom: ${chatId}`,
			error
		);
	}
});

// --- [ ⭐️⭐️⭐️ 수정 ⭐️⭐️⭐️ ] onMessageCreated 함수 ---

exports.onMessageCreated = onDocumentCreated(
	"chats/{chatId}/messages/{messageId}",
	async (event) => {
		const messageData = event.data.data();
		const chatId = event.params.chatId;

		const senderId = messageData.senderId;
		const messageText = messageData.text || "사진을 보냈습니다.";

		logger.log(`[Push] New message from ${senderId} in chat ${chatId}`);

		// 1. 수신자 UID 찾기
		const chatDocRef = db.collection("chats").doc(chatId);
		const chatDocSnap = await chatDocRef.get();
		if (!chatDocSnap.exists) {
			logger.warn(`[Push] Chat doc ${chatId} not found.`);
			return null;
		}

		const participants = chatDocSnap.data().participants || [];
		const recipientId = participants.find((uid) => uid !== senderId);

		if (!recipientId) {
			logger.warn(`[Push] Recipient ID not found in chat ${chatId}.`);
			return null;
		}

		// 2. 수신자 FCM 토큰 조회
		const recipientDocRef = db.collection("members").doc(recipientId);
		const recipientDocSnap = await recipientDocRef.get();
		if (!recipientDocSnap.exists) {
			logger.warn(`[Push] Recipient member doc ${recipientId} not found.`);
			return null;
		}

		const tokens = recipientDocSnap.data().fcmTokens || [];
		if (tokens.length === 0) {
			logger.log(`[Push] Recipient ${recipientId} has no FCM tokens.`);
			return null;
		}

		// 3. 발신자 이름 조회
		const senderDocRef = db.collection("members").doc(senderId);
		const senderDocSnap = await senderDocRef.get();
		const senderName = senderDocSnap.exists
			? senderDocSnap.data().name
			: "누군가";

		// [ 4. 수정 ] 'data-only' 메시지로 변경
		// 'notification' 필드를 제거하고, 모든 정보를 'data' 객체로 이동
		const messages = tokens.map((token) => ({
			// ❌ 'notification' 객체 제거
			
			// ✅ 'data' 객체로 모든 정보 전달
			data: {
				title: `${senderName}님`,
				body: messageText,
				icon: "/icon-192.png", // 아이콘
				url: `/chat/${senderId}` // 클릭 시 이동할 링크
			},
			
			// (참고: webpush 설정은 data만 보낼 땐 필수는 아님)
			webpush: {
				fcmOptions: {
					link: `/chat/${senderId}`
				}
			},
			token: token
		}));

		try {
			// [ 5. 수정 ] 'sendEach' 사용
			const response = await messaging.sendEach(messages);
			logger.log(`[Push] Successfully sent message to ${response.successCount} tokens.`);

			// 6. 만료된 토큰 정리
			if (response.failureCount > 0) {
				const tokensToRemove = [];
				response.responses.forEach((resp, idx) => {
					if (!resp.success) {
						if (resp.error.code === 'messaging/registration-token-not-registered') {
							tokensToRemove.push(tokens[idx]);
						}
					}
				});

				if (tokensToRemove.length > 0) {
					logger.log(`[Push] Removing ${tokensToRemove.length} invalid tokens.`);
					const currentTokens = recipientDocSnap.data().fcmTokens || [];
					const validTokens = currentTokens.filter((t) => !tokensToRemove.includes(t));
					await recipientDocRef.update({ fcmTokens: validTokens });
				}
			}
		} catch (error) {
			logger.error(`[Push] Error sending messages for chat ${chatId}:`, error);
		}
		return null;
	}
);