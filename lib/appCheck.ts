import { appCheck as adminAppCheck } from "./firebase-admin";


export function shouldBypassAppCheck(): boolean {
  return process.env.ALLOW_NO_APP_CHECK === 'true' || process.env.NODE_ENV !== 'production';
}

export async function verifyAppCheckToken(token: string): Promise<boolean> {
  if (shouldBypassAppCheck()) {
    return true;
  }

  if (!token) return false;
  
  try {
    // In dev, you might want to bypass or use a specific dev token
    // For production, use Firebase Admin SDK to verify
    const appCheckTokenResponse = await adminAppCheck.verifyToken(token);

    return !!appCheckTokenResponse;
  } catch (error) {
    console.error('App Check verification failed:', error);
    return false;
  }
}

export function getAppCheckToken(req: any): string | undefined {
  const token = req.headers['x-firebase-appcheck'] || 
                req.headers['x-firebase-app-check'];
  return Array.isArray(token) ? token[0] : token;
}
