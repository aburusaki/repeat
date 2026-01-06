
export interface Category {
  id: string | number;
  name: string;
}

export interface Sentence {
  id: string | number;
  text: string;
  categories?: Category[];
}

export interface AppState {
  currentNumber: number;
  currentSentence: string;
  count: number;
  isOffline: boolean;
}

export interface SupabaseConfig {
  url: string;
  key: string;
}
