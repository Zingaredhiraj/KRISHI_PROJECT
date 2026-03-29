export type Language = 'en' | 'hi' | 'ta' | 'te' | 'mr';

export interface User {
  id: number;
  phone: string;
  name: string;
  email?: string;
  location?: string;
  language: Language;
  avatar_url?: string;
  profile_photo?: string;
  crop_preferences?: string[];
  is_active: boolean;
  created_at: string;
}

export interface WeatherData {
  id: number;
  location: string;
  temperature: number;
  condition: string;
  humidity: number;
  wind_speed: number;
  forecast: WeatherForecast[];
  recorded_at: string;
  water_level_suggestion?: string;
  fertilizer_suggestion?: string;
}

export interface WeatherForecast {
  day: string;
  temp: number;
  condition: string;
}

export interface MarketPrice {
  id: number;
  crop: string;
  price: number;
  unit: string;
  market: string;
  change_percent: number;
  recorded_at: string;
}

export interface ChatMessage {
  id: number;
  type: 'user' | 'ai';
  content: string;
  image_url?: string;
  created_at: string;
}

export interface AIChatResponse {
  response: string;
  suggestions: string[];
}

export interface DiseaseDetection {
  id: number;
  image_url: string;
  detected_disease?: string;
  confidence?: number;
  crop_type?: string;
  treatment?: string;
  prevention?: string;
  created_at: string;
}

export interface CommunityPost {
  id: number;
  caption?: string;
  content?: string;
  media_type: 'text' | 'image' | 'video' | 'image_video';
  image_url?: string;
  video_url?: string;
  media_urls?: string[];
  thumbnail_url?: string;
  location?: string;
  tags?: string[];
  ai_tags?: string[];
  status: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  saves_count: number;
  views_count: number;
  created_at: string;
  updated_at: string;
  user: {
    id: number;
    name: string;
    avatar_url?: string;
    profile_photo?: string;
    location?: string;
  };
  is_liked: boolean;
  is_saved: boolean;
  is_following_author: boolean;
}

export interface GovernmentScheme {
  id: number;
  title: string;
  title_hi?: string;
  title_ta?: string;
  title_te?: string;
  title_mr?: string;
  description: string;
  description_hi?: string;
  description_ta?: string;
  description_te?: string;
  description_mr?: string;
  eligibility?: string;
  eligibility_hi?: string;
  deadline?: string;
  documents_required?: string[];
  application_link?: string;
  is_active: boolean;
}

export interface UserDocument {
  id: number;
  name: string;
  file_url: string;
  file_size?: string;
  document_type?: string;
  uploaded_at: string;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  is_read: boolean;
  created_at: string;
}

export interface ExpertConsultation {
  id: number;
  query: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  expert_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  weather_temp: number;
  market_change: string;
  community_posts: number;
  new_schemes: number;
}

export interface Translations {
  [key: string]: {
    [key: string]: string;
  };
}

export interface UserActivity {
  id: number;
  activity_type: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface ActivitySummary {
  total_scans: number;
  total_ai_queries: number;
  total_community_posts: number;
  total_market_searches: number;
  total_scheme_views: number;
  total_documents: number;
  member_since_days: number;
}

export interface ProfileDashboard {
  user: User;
  activity_summary: ActivitySummary;
  recent_activities: UserActivity[];
  recent_scans: DiseaseDetection[];
  recent_ai_queries: ChatMessage[];
  recent_posts: CommunityPost[];
}
