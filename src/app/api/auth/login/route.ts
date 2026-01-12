import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const SECRET = process.env.NEXTAUTH_SECRET || 'secret';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const userId = email;
    const token = jwt.sign({ userId }, SECRET);
    return NextResponse.json({ token });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
