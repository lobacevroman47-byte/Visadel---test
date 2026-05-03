export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          telegram_id: number;
          first_name: string;
          last_name: string | null;
          username: string | null;
          photo_url: string | null;
          phone: string | null;
          email: string | null;
          bonus_balance: number;
          is_influencer: boolean;
          referral_code: string;
          referred_by: string | null;
          last_bonus_date: string | null;
          bonus_streak: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          telegram_id: number;
          first_name: string;
          last_name?: string | null;
          username?: string | null;
          photo_url?: string | null;
          phone?: string | null;
          email?: string | null;
          bonus_balance?: number;
          is_influencer?: boolean;
          referral_code: string;
          referred_by?: string | null;
          last_bonus_date?: string | null;
          bonus_streak?: number;
        };
        Update: {
          first_name?: string;
          last_name?: string | null;
          username?: string | null;
          photo_url?: string | null;
          phone?: string | null;
          email?: string | null;
          bonus_balance?: number;
          is_influencer?: boolean;
          referral_code?: string;
          last_bonus_date?: string | null;
          bonus_streak?: number;
          updated_at?: string;
        };
      };
      applications: {
        Row: {
          id: string;
          user_telegram_id: number;
          country: string;
          visa_type: string;
          visa_id: string;
          price: number;
          urgent: boolean;
          status: 'draft' | 'pending_payment' | 'pending_confirmation' | 'in_progress' | 'ready';
          form_data: Record<string, unknown>;
          payment_proof_url: string | null;
          visa_file_url: string | null;
          bonuses_used: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_telegram_id: number;
          country: string;
          visa_type: string;
          visa_id: string;
          price: number;
          urgent?: boolean;
          status?: 'draft' | 'pending_payment' | 'pending_confirmation' | 'in_progress' | 'ready';
          form_data?: Record<string, unknown>;
          payment_proof_url?: string | null;
          visa_file_url?: string | null;
          bonuses_used?: number;
        };
        Update: {
          status?: 'draft' | 'pending_payment' | 'pending_confirmation' | 'in_progress' | 'ready';
          form_data?: Record<string, unknown>;
          payment_proof_url?: string | null;
          visa_file_url?: string | null;
          bonuses_used?: number;
          updated_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          user_telegram_id: number;
          task_type: string;
          title: string;
          reward: number;
          status: 'pending' | 'submitted' | 'approved' | 'rejected';
          proof_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_telegram_id: number;
          task_type: string;
          title: string;
          reward: number;
          status?: 'pending' | 'submitted' | 'approved' | 'rejected';
          proof_url?: string | null;
        };
        Update: {
          status?: 'pending' | 'submitted' | 'approved' | 'rejected';
          proof_url?: string | null;
          updated_at?: string;
        };
      };
      reviews: {
        Row: {
          id: string;
          user_telegram_id: number;
          application_id: string;
          country: string;
          rating: number;
          text: string;
          status: 'pending' | 'approved' | 'rejected';
          created_at: string;
        };
        Insert: {
          user_telegram_id: number;
          application_id: string;
          country: string;
          rating: number;
          text: string;
          status?: 'pending' | 'approved' | 'rejected';
        };
        Update: {
          status?: 'pending' | 'approved' | 'rejected';
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
