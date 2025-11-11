<script>
	import { createEventDispatcher } from 'svelte';

	/**
	 * @type {import('svelte').SvelteComponent}
	 */
	// [ 1. Props ]
	// 사용할 때 제목과 메시지를 전달받습니다.
	export let title = '확인';
	export let message = '정말로 실행하시겠습니까?';
	export let confirmText = '확인';
	export let cancelText = '취소';

	const dispatch = createEventDispatcher();

	// [ 2. Event Handlers ]
	function handleCancel() {
		// 'cancel' 이벤트를 부모로 전달
		dispatch('cancel');
	}

	function handleConfirm() {
		// 'confirm' 이벤트를 부모로 전달
		dispatch('confirm');
	}
</script>

<div class="modal-overlay" on:click={handleCancel}>
	<div class="modal-content" on:click|stopPropagation>
		<h2>{title}</h2>
		<p>{message}</p>

		<div class="modal-actions">
			<button class="btn-cancel" on:click={handleCancel}>{cancelText}</button>
			<button class="btn-confirm" on:click={handleConfirm}>{confirmText}</button>
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
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 200; /* AlertModal과 동일한 레벨 */
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
		white-space: pre-wrap;
	}
	.modal-actions {
		display: flex;
		/* 가로로 배치 */
		flex-direction: row;
		gap: 12px;
		width: 100%;
	}

	/* 공통 버튼 스타일 */
	.btn-cancel,
	.btn-confirm {
		flex: 1; /* 1:1 비율로 공간 차지 */
		padding: 12px;
		border: none;
		border-radius: 8px;
		font-size: 16px;
		font-weight: bold;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	/* 취소 버튼 (회색) */
	.btn-cancel {
		background-color: #f0f0f0;
		color: #333;
	}
	.btn-cancel:hover {
		background-color: #e0e0e0;
	}

	/* 확인 버튼 (빨간색 - AlertModal과 동일) */
	.btn-confirm {
		background-color: #ff6b6b;
		color: white;
	}
	.btn-confirm:hover {
		background-color: #e55b5b;
	}
</style>