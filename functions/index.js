/**
 * Firebase Cloud Functions
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
// [ 1. 수정 ] onDocumentUpdated 임포트
const {
	onDocumentDeleted,
	onDocumentCreated,
	onDocumentUpdated // 신규
} = require("firebase-functions/v2/firestore");
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
	// ... (기존과 동일)
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
	// ... (기존과 동일)
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
	// ... (기존과 동일)
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

// --- [ 2. 수정 ] onMessageCreated 함수 ---
// (수신자의 'notificationSettings.chats' 확인 로직 추가)
exports.onMessageCreated = onDocumentCreated(
	"chats/{chatId}/messages/{messageId}",
	async (event) => {
		const messageData = event.data.data();
		const chatId = event.params.chatId;

		const senderId = messageData.senderId;
		const messageText = messageData.text || "사진을 보냈습니다.";

		logger.log(`[Push-Chat] New message from ${senderId} in chat ${chatId}`);

		// 1. 수신자 UID 찾기
		const chatDocRef = db.collection("chats").doc(chatId);
		const chatDocSnap = await chatDocRef.get();
		if (!chatDocSnap.exists) {
			logger.warn(`[Push-Chat] Chat doc ${chatId} not found.`);
			return null;
		}

		const participants = chatDocSnap.data().participants || [];
		const recipientId = participants.find((uid) => uid !== senderId);

		if (!recipientId) {
			logger.warn(`[Push-Chat] Recipient ID not found in chat ${chatId}.`);
			return null;
		}

		// 2. 수신자 프로필(토큰 및 설정) 조회
		const recipientDocRef = db.collection("members").doc(recipientId);
		const recipientDocSnap = await recipientDocRef.get();
		if (!recipientDocSnap.exists) {
			logger.warn(`[Push-Chat] Recipient member doc ${recipientId} not found.`);
			return null;
		}
		const recipientData = recipientDocSnap.data();

		// [ ⭐️ 신규 ⭐️ ] 3. 수신자의 '채팅' 알림 설정 확인
		const settings = recipientData.notificationSettings || {};
		if (settings.chats === false) { // (undefined는 true로 간주)
			logger.log(`[Push-Chat] Recipient ${recipientId} has 'chats' notifications disabled.`);
			return null;
		}

		// 4. 수신자 토큰 확인
		const tokens = recipientData.fcmTokens || [];
		if (tokens.length === 0) {
			logger.log(`[Push-Chat] Recipient ${recipientId} has no FCM tokens.`);
			return null;
		}

		// 5. 발신자 이름 조회
		const senderDocRef = db.collection("members").doc(senderId);
		const senderDocSnap = await senderDocRef.get();
		const senderName = senderDocSnap.exists
			? senderDocSnap.data().name
			: "누군가";

		// 6. 페이로드 구성 (data-only)
		const messages = tokens.map((token) => ({
			data: {
				title: `${senderName}님`,
				body: messageText,
				icon: "/icon-192.png",
				badge: "/icon-192.png",
				url: `/chat/${senderId}`
			},
			webpush: {
				fcmOptions: {
					link: `/chat/${senderId}`
				}
			},
			token: token
		}));

		try {
			// 7. 발송 및 토큰 정리 (기존과 동일)
			const response = await messaging.sendEach(messages);
			logger.log(`[Push-Chat] Successfully sent message to ${response.successCount} tokens.`);
			
			if (response.failureCount > 0) {
				const tokensToRemove = [];
				response.responses.forEach((resp, idx) => {
					if (!resp.success && resp.error.code === 'messaging/registration-token-not-registered') {
						tokensToRemove.push(tokens[idx]);
					}
				});
				if (tokensToRemove.length > 0) {
					logger.log(`[Push-Chat] Removing ${tokensToRemove.length} invalid tokens.`);
					const currentTokens = recipientData.fcmTokens || [];
					const validTokens = currentTokens.filter((t) => !tokensToRemove.includes(t));
					await recipientDocRef.update({ fcmTokens: validTokens });
				}
			}
		} catch (error) {
			logger.error(`[Push-Chat] Error sending messages for chat ${chatId}:`, error);
		}
		return null;
	}
);

// --- [ 3. 신규 ] '좋아요' 및 '매칭' 알림 트리거 ---
exports.onMemberUpdate = onDocumentUpdated("members/{userId}", async (event) => {
	const beforeData = event.data.before.data();
	const afterData = event.data.after.data();
	const userId = event.params.userId; // 알림을 '받을' 사람

	// 1. 설정 확인 (알림 설정 객체가 없으면 아무것도 안 함)
	const settings = afterData.notificationSettings || {};
	const tokens = afterData.fcmTokens || [];
	
	if (tokens.length === 0) {
		logger.log(`[Push-Update] User ${userId} has no tokens. Exiting.`);
		return null;
	}

	// 2. '매칭' 알림 확인 (settings.matches !== false 이고, matched 배열에 변화가 있을 때)
	if (settings.matches !== false) {
		const beforeMatched = beforeData.matched || [];
		const afterMatched = afterData.matched || [];
		
		if (afterMatched.length > beforeMatched.length) {
			// 새 매치 발생
			const newMatcherUid = afterMatched.find((uid) => !beforeMatched.includes(uid));
			if (newMatcherUid) {
				logger.log(`[Push-Match] New match detected for ${userId} from ${newMatcherUid}`);
				// 매치 상대(알림 보낸 사람)의 이름 조회
				const matcherDoc = await db.collection("members").doc(newMatcherUid).get();
				const matcherName = matcherDoc.exists ? matcherDoc.data().name : "누군가";

				const payload = {
					data: {
						title: "🎉 It's a Match!",
						body: `${matcherName}님과 매치되었습니다!`,
						icon: "/icon-192.png",
						badge: "/icon-192.png",
						url: "/matches" // 매치 목록으로 이동
					},
					webpush: { fcmOptions: { link: "/matches" } },
					tokens: tokens
				};
				// (sendMulticast가 404 오류가 났었으므로 sendEach 사용)
				const messages = tokens.map(token => ({ ...payload, token }));
				await messaging.sendEach(messages);
				logger.log(`[Push-Match] Sent match notification to ${userId}`);
			}
		}
	}

	// 3. '좋아요' 알림 확인 (settings.likes !== false 이고, likesReceivedCount가 변경되었을 때)
	// (주의: 매치 시에도 likesReceivedCount가 같이 업데이트 될 수 있으므로, 매치 알림과 중복 발송될 수 있음)
	// (-> 여기서는 '좋아요'가 먼저 오고 '매치'가 나중이라고 가정)
	if (settings.likes !== false) {
		const beforeLikes = beforeData.likesReceivedCount || {};
		const afterLikes = afterData.likesReceivedCount || {};
		
		// '좋아요'를 보낸 UID 찾기
		let newLikerUid = null;
		for (const uid of Object.keys(afterLikes)) {
			if ((afterLikes[uid] || 0) > (beforeLikes[uid] || 0)) {
				// 이 사람이 새로 '좋아요'를 보냈거나 횟수를 증가시킴
				
				// 단, 이미 매치된 사람의 좋아요는 알림을 보내지 않음 (중복 방지)
				const isAlreadyMatched = (afterData.matched || []).includes(uid);
				if (!isAlreadyMatched) {
					newLikerUid = uid;
					break;
				}
			}
		}

		if (newLikerUid) {
			logger.log(`[Push-Like] New like detected for ${userId} from ${newLikerUid}`);
			// '좋아요' 보낸 사람의 이름 조회
			const likerDoc = await db.collection("members").doc(newLikerUid).get();
			const likerName = likerDoc.exists ? likerDoc.data().name : "누군가";
			
			const payload = {
				data: {
					title: "❤️ 새로운 LIKE",
					body: `${likerName}님이 회원님에게 'LIKE'를 보냈습니다!`,
					icon: "/icon-192.png",
					badge: "/icon-192.png",
					url: "/likes" // '받은 LIKE' 목록으로 이동
				},
				webpush: { fcmOptions: { link: "/likes" } },
				tokens: tokens
			};
			const messages = tokens.map(token => ({ ...payload, token }));
			await messaging.sendEach(messages);
			logger.log(`[Push-Like] Sent like notification to ${userId}`);
		}
	}

	return null;
});