<script>
	import { createEventDispatcher } from 'svelte';

	/**
	 * @type {import('svelte').SvelteComponent}
	 */
	// [ 1. Props ]
	// '나'와 '매치된 상대'의 정보를 받습니다.
	export let currentUser;
	export let matchedUser;

	const dispatch = createEventDispatcher();

	// [ 2. 아바타 추출 ]
	// (프로필 정보가 없을 수도 있는 경우 대비)
	$: myAvatar = currentUser?.avatar || 'https://placehold.co/100x100/indigo/white?text=ME';
	$: targetAvatar =
		(matchedUser?.photos && matchedUser.photos[0]) ||
		'https://placehold.co/100x100/grey/white?text=YOU';
</script>

<div class="modal-overlay">
	<div class="modal-content" on:click|stopPropagation>
		<div class="confetti">🎉</div>
		<h2>IT'S A MATCH!</h2>
		<p>{matchedUser.name}님과 매치되었습니다!</p>

		<div class="avatars">
			<img src={myAvatar} alt="My Avatar" class="match-avatar" />
			<span class="heart-icon">❤️</span>
			<img src={targetAvatar} alt={matchedUser.name} class="match-avatar" />
		</div>

		<div class="modal-actions">
			<button class="btn-chat" on:click={() => dispatch('close')}>
				(채팅 기능 - 추후 구현)
			</button>
			<button class="btn-close" on:click={() => dispatch('close')}>
				계속 탐색하기
			</button>
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.6);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 300; /* 최상단에 표시 */
		backdrop-filter: blur(5px);
	}
	.modal-content {
		background-color: #fff;
		padding: 30px;
		border-radius: 20px;
		width: 80%;
		max-width: 340px;
		text-align: center;
		box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
		animation: popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	}

	@keyframes popIn {
		from {
			transform: scale(0.8);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	.confetti {
		font-size: 40px;
		animation: tada 1.5s ease-in-out infinite;
	}

	@keyframes tada {
		0% {
			transform: scale(1);
		}
		10%,
		20% {
			transform: scale(0.9) rotate(-3deg);
		}
		30%,
		50%,
		70%,
		90% {
			transform: scale(1.1) rotate(3deg);
		}
		40%,
		60%,
		80% {
			transform: scale(1.1) rotate(-3deg);
		}
		100% {
			transform: scale(1) rotate(0);
		}
	}

	.modal-content h2 {
		margin-top: 10px;
		color: #ff6b6b;
		font-size: 28px;
		font-weight: 800;
	}
	.modal-content p {
		color: #333;
		margin-bottom: 24px;
		font-size: 18px;
		line-height: 1.5;
	}

	.avatars {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 20px;
		margin-bottom: 30px;
	}
	.match-avatar {
		width: 100px;
		height: 100px;
		border-radius: 50%;
		object-fit: cover;
		border: 4px solid #fff;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
	}
	.heart-icon {
		font-size: 30px;
		color: #ff6b6b;
	}

	.modal-actions {
		display: flex;
		flex-direction: column; /* 버튼을 세로로 배치 */
		gap: 12px;
		width: 100%;
	}

	.btn-chat,
	.btn-close {
		padding: 14px;
		border: none;
		border-radius: 12px;
		font-size: 16px;
		font-weight: bold;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-chat {
		background-color: #ff6b6b;
		color: white;
	}
	.btn-chat:hover {
		background-color: #e55b5b;
	}

	.btn-close {
		background-color: #f0f0f0;
		color: #333;
	}
	.btn-close:hover {
		background-color: #e0e0e0;
	}
</style>