<script>
	import { createEventDispatcher } from 'svelte';

	/**
	 * @type {import('svelte').SvelteComponent}
	 */
	export let title = '알림';
	export let message = '';

	const dispatch = createEventDispatcher();

	function handleClose() {
		dispatch('close');
	}
</script>

<div class="modal-overlay" on:click={handleClose}>
	<div class="modal-content" on:click|stopPropagation>
		<h2>{title}</h2>
		<p>{message}</p>
		<div class="modal-actions">
			<button class="confirm-btn" on:click={handleClose}>확인</button>
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
		z-index: 200; /* 다른 모달(100)보다 위에 표시 */
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
		white-space: pre-wrap; /* \n (줄바꿈)을 인식하도록 */
	}
	.modal-actions {
		display: flex;
		justify-content: center;
		width: 100%;
	}
	.confirm-btn {
		width: 100%;
		padding: 12px;
		background-color: #ff6b6b;
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 16px;
		font-weight: bold;
		cursor: pointer;
		transition: background-color 0.2s;
	}
	.confirm-btn:hover {
		background-color: #e55b5b;
	}
</style>