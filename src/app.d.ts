// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

// so session.user.id isn't a mystery typescript fight
declare module '@auth/core/types' {
	interface Session {
		user?: {
			id?: string;
			name?: string | null;
			email?: string | null;
			image?: string | null;
		};
	}

	interface User {
		id?: string;
	}
}

export {};
