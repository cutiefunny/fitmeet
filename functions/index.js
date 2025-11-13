/**
 * Firebase Cloud Functions
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const {
	onDocumentDeleted,
	onDocumentCreated,
	onDocumentUpdated
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

// --- [ 1. 수정 ] onMessageCreated 함수 ---

// (기존) 하드코딩된 정규식
const phoneRegex = /(010|02|0\d{1,2})[ \-.]?\d{3,4}[ \-.]?\d{4}/g;
const emailRegex = /[\w-\.]+@([\w-]+\.)+[\w-]{2,4}/g;
const instaRegex = /(instagram\.com\/[a-zA-Z0-9_.]+|@[a-zA-Z0-9_.]+)/gi;

// (신규) 정규식 특수 문자를 이스케이프하는 헬퍼
function escapeRegExp(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

exports.onMessageCreated = onDocumentCreated(
	"chats/{chatId}/messages/{messageId}",
	async (event) => {
		const messageData = event.data.data();
		const chatId = event.params.chatId;
		const messageId = event.params.messageId;

		const senderId = messageData.senderId;
		const messageText = messageData.text || "";

		// --- [ 2. 신규 ] 서버 측 개인정보 검증 (DB 연동) ---
		let isBlocked = false;

		// 1. 하드코딩된 정규식 검사
		if (
			phoneRegex.test(messageText) ||
			emailRegex.test(messageText) ||
			instaRegex.test(messageText)
		) {
			isBlocked = true;
		}

		// 2. Firestore의 'bannedWords' 목록 검사
		if (!isBlocked) {
			try {
				const filteringDocRef = db.collection("config").doc("filtering");
				const filteringSnap = await filteringDocRef.get();
				
				if (filteringSnap.exists) {
					const bannedWords = filteringSnap.data().bannedWords || [];
					if (bannedWords.length > 0) {
						// (중요) 단어 목록으로 동적 정규식 생성 (이스케이프 포함)
						const bannedWordPattern = bannedWords.map(escapeRegExp).join('|');
						const bannedWordRegex = new RegExp(bannedWordPattern, 'giu'); // 'u' 플래그로 유니코드 지원
						
						if (bannedWordRegex.test(messageText)) {
							isBlocked = true;
						}
					}
				}
			} catch (e) {
				logger.error(`[Filter] Error fetching banned words: ${e.message}`);
				// (DB 조회 실패 시 일단 통과시킴 - 선택 사항)
			}
		}

		// 3. 차단 로직 실행
		if (isBlocked) {
			logger.warn(
				`[Filter] Deleting message ${messageId} from ${senderId} due to filtered content.`
			);

			// (수정) 메시지 삭제 대신 'isBlocked' 플래그를 true로 업데이트
			// (사용자에게 차단 사실을 명확히 보여주기 위함)
			await event.data.ref.update({
				isBlocked: true,
				text: "(개인정보/부적절한 단어가 포함되어 차단된 메시지입니다.)"
			});

			// 채팅방 'lastMessage' 업데이트
			const chatDocRef = db.collection("chats").doc(chatId);
			await chatDocRef.set(
				{
					lastMessage: "(차단된 메시지)",
					lastMessageTimestamp: messageData.timestamp,
					readBy: { [senderId]: true },
					isBlocked: true
				},
				{ merge: true }
			);

			// 푸시 알림 및 이후 로직 중단
			return null;
		}

		// --- (이하 푸시 알림 로직은 기존과 동일) ---
		
		logger.log(`[Push-Chat] New message from ${senderId} in chat ${chatId}`);

		const chatDocRef = db.collection("chats").doc(chatId);
		const chatDocSnap = await chatDocRef.get();
		if (!chatDocSnap.exists) {
			logger.warn(`[Push-Chat] Chat doc ${chatId} not found.`);
			return null;
		}

		if (chatDocSnap.data().isBlocked) {
			await chatDocRef.update({ isBlocked: false });
		}

		const participants = chatDocSnap.data().participants || [];
		const recipientId = participants.find((uid) => uid !== senderId);

		if (!recipientId) {
			logger.warn(`[Push-Chat] Recipient ID not found in chat ${chatId}.`);
			return null;
		}

		const recipientDocRef = db.collection("members").doc(recipientId);
		const recipientDocSnap = await recipientDocRef.get();
		if (!recipientDocSnap.exists) {
			logger.warn(`[Push-Chat] Recipient member doc ${recipientId} not found.`);
			return null;
		}
		const recipientData = recipientDocSnap.data();

		const settings = recipientData.notificationSettings || {};
		if (settings.chats === false) {
			logger.log(`[Push-Chat] Recipient ${recipientId} has 'chats' notifications disabled.`);
			return null;
		}

		const tokens = recipientData.fcmTokens || [];
		if (tokens.length === 0) {
			logger.log(`[Push-Chat] Recipient ${recipientId} has no FCM tokens.`);
			return null;
		}

		const senderDocRef = db.collection("members").doc(senderId);
		const senderDocSnap = await senderDocRef.get();
		const senderName = senderDocSnap.exists
			? senderDocSnap.data().name
			: "누군가";

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

// --- [ 4. 수정 ] onMemberUpdate 함수 ---
// (기존과 동일)
exports.onMemberUpdate = onDocumentUpdated("members/{userId}", async (event) => {
	// ... (기존 좋아요/매칭 알림 코드)
	const beforeData = event.data.before.data();
	const afterData = event.data.after.data();
	const userId = event.params.userId;

	const settings = afterData.notificationSettings || {};
	const tokens = afterData.fcmTokens || [];
	
	if (tokens.length === 0) {
		logger.log(`[Push-Update] User ${userId} has no tokens. Exiting.`);
		return null;
	}

	// 2. '매칭' 알림 확인
	if (settings.matches !== false) {
		const beforeMatched = beforeData.matched || [];
		const afterMatched = afterData.matched || [];
		
		if (afterMatched.length > beforeMatched.length) {
			const newMatcherUid = afterMatched.find((uid) => !beforeMatched.includes(uid));
			if (newMatcherUid) {
				logger.log(`[Push-Match] New match detected for ${userId} from ${newMatcherUid}`);
				const matcherDoc = await db.collection("members").doc(newMatcherUid).get();
				const matcherName = matcherDoc.exists ? matcherDoc.data().name : "누군가";

				const payload = {
					data: {
						title: "🎉 It's a Match!",
						body: `${matcherName}님과 매치되었습니다!`,
						icon: "/icon-192.png",
						badge: "/icon-192.png",
						url: "/matches"
					},
					webpush: { fcmOptions: { link: "/matches" } },
					tokens: tokens
				};
				const messages = tokens.map(token => ({ ...payload, token }));
				await messaging.sendEach(messages);
				logger.log(`[Push-Match] Sent match notification to ${userId}`);
			}
		}
	}

	// 3. '좋아요' 알림 확인
	if (settings.likes !== false) {
		const beforeLikes = beforeData.likesReceivedCount || {};
		const afterLikes = afterData.likesReceivedCount || {};
		
		let newLikerUid = null;
		for (const uid of Object.keys(afterLikes)) {
			if ((afterLikes[uid] || 0) > (beforeLikes[uid] || 0)) {
				const isAlreadyMatched = (afterData.matched || []).includes(uid);
				if (!isAlreadyMatched) {
					newLikerUid = uid;
					break;
				}
			}
		}

		if (newLikerUid) {
			logger.log(`[Push-Like] New like detected for ${userId} from ${newLikerUid}`);
			const likerDoc = await db.collection("members").doc(newLikerUid).get();
			const likerName = likerDoc.exists ? likerDoc.data().name : "누군가";
			
			const payload = {
				data: {
					title: "❤️ 새로운 LIKE",
					body: `${likerName}님이 회원님에게 'LIKE'를 보냈습니다!`,
					icon: "/icon-192.png",
					badge: "/icon-192.png",
					url: "/likes"
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