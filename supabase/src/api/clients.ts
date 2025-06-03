
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

let supabaseSingleton: SupabaseClient | null = null;
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseSingleton = createClient(supabaseUrl, supabaseAnonKey);
  } catch (e) {
    // console.error("Ошибка инициализации Supabase:", e); // Removed
  }
} else {
    // if (!supabaseUrl) console.error("Ключ VITE_SUPABASE_URL отсутствует."); // Removed
    // if (!supabaseAnonKey) console.error("Ключ VITE_SUPABASE_ANON_KEY отсутствует."); // Removed
}
export const supabase = supabaseSingleton;


const geminiApiKeyFromEnv = process.env.API_KEY;
let genAISingleton: GoogleGenAI | null = null;

if (geminiApiKeyFromEnv && typeof geminiApiKeyFromEnv === 'string' && geminiApiKeyFromEnv.trim() !== '') {
  try {
    genAISingleton = new GoogleGenAI({ apiKey: geminiApiKeyFromEnv });
  } catch (e) {
    // console.error("Ошибка инициализации GoogleGenAI:", e); // Removed
  }
} else {
    // if (!geminiApiKeyFromEnv) console.error("Ключ API Gemini (process.env.API_KEY) отсутствует."); // Removed
    // else console.error("Ключ API Gemini (process.env.API_KEY) недействителен (пустой или не строка)."); // Removed
}
export const genAI = genAISingleton;
