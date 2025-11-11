<script>
	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();
</script>

<div class="modal-overlay" on:click={() => dispatch('close')}>
	<div class="modal-content" on:click|stopPropagation>
		<h2>로그인</h2>
		<p>FitMeet에 오신 것을 환영합니다!<br />더 많은 기능을 위해 로그인해주세요.</p>
		<button class="google-login-btn" on:click={() => dispatch('googleLogin')}>
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px"
				><path
					fill="#FFC107"
					d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
				/><path
					fill="#FF3D00"
					d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
				/><path
					fill="#4CAF50"
					d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
				/><path
					fill="#1976D2"
					d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
				/></svg
			>
			구글 계정으로 시작하기
		</button>
		<button class="close-modal-btn" on:click={() => dispatch('close')}>닫기</button>
	</div>
</div>

<style>
	/* +page.svelte의 모달 공통 스타일 및 로그인 모달 스타일 */
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
		z-index: 100;
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
	}
	.google-login-btn {
		width: 100%;
		padding: 12px;
		background-color: #fff;
		border: 1px solid #ddd;
		border-radius: 8px;
		font-size: 16px;
		font-weight: 500;
		color: #555;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		cursor: pointer;
		transition: background-color 0.2s;
		margin-bottom: 12px;
	}
	.google-login-btn:hover {
		background-color: #f5f5f5;
	}
	.close-modal-btn {
		background: none;
		border: none;
		color: #999;
		font-size: 14px;
		cursor: pointer;
		padding: 8px;
		text-decoration: underline;
	}
</style>