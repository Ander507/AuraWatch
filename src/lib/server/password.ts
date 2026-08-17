import bcrypt from 'bcryptjs';

const ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
	// bcrypt only meaningfully uses 72 bytes — keep it capped
	const pw = String(plain || '').slice(0, 72);
	return bcrypt.hash(pw, ROUNDS);
}

/** checking the password hash against what they typed in */
export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
	if (!hash) return false;
	try {
		const pw = String(plain || '').slice(0, 72);
		return await bcrypt.compare(pw, hash);
	} catch {
		return false;
	}
}
