import axios from "axios";
import { Language } from "./types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim() !== ""
    ? process.env.NEXT_PUBLIC_API_URL
    : (typeof window !== "undefined" ? "" : (process.env.BACKEND_URL || "http://localhost:8000"));

// ✅ Create axios instance
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: false,
});


// ✅ Attach token safely (Next.js compatible)
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});


// ✅ Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined") {
      if (error.response?.status === 401) {
        console.warn("Unauthorized → logging out");

        localStorage.removeItem("token");
        localStorage.removeItem("user");

        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;

//
// ================= AUTH =================
//
export const authApi = {
  login: (email: string) => api.post("/auth/login", { email }),
  sendOTP: (email: string) => api.post("/auth/otp/send", { email }),
  verifyOTP: (email: string, otp?: string) =>
    api.post("/auth/otp/verify", { email, otp }),
  getMe: () => api.get("/auth/me"),
  updateProfile: (data: Partial<{
    name: string;
    email: string;
    location: string;
    language: Language;
    avatar_url: string;
    profile_photo: string;
    crop_preferences: string[];
  }>) => api.put("/auth/profile", data),
};

//
// ================= WEATHER =================
//
export const weatherApi = {
  getCurrent: (params?: { location?: string; lat?: number; lon?: number }) =>
    api.get("/weather/current", { params }),
};

//
// ================= MARKET =================
//
export const marketApi = {
  getPrices: (params?: { crop?: string; market?: string }) =>
    api.get("/market/prices", { params }),
  getMarketPrices: (params?: {
    taluka?: string;
    crop?: string;
    district?: string;
    state?: string;
    date?: string;
    sort_by?: string;
    offset?: number;
    limit?: number;
  }) => api.get("/market/prices", { params }),
  getDistricts: (params?: { state?: string }) => api.get("/market/districts", { params }),
  getStats: (params?: { state?: string }) => api.get("/market/stats", { params }),
  getHistory: (crop: string, market: string, days?: number) =>
    api.get("/market/history", { params: { crop, market, days } }),
};

//
// ================= AI CHAT =================
//
export const chatApi = {
  sendMessage: (message: string, language: Language, image_url?: string) =>
    api.post("/ai/chat", { message, language, image_url }),
  getHistory: () => api.get("/ai/chat/history"),
};

//
// ================= DISEASE =================
//
export const diseaseApi = {
  detect: (image_url: string, crop_hint?: string) =>
    api.post("/disease/detect", { image_url, crop_hint: crop_hint || undefined }),
  getHistory: () => api.get("/disease/history"),
};

//
// ================= CROP PREDICTION =================
//
export const cropApi = {
  predict: (data: {
    soil_type: string;
    water_level: string;
    temperature_history: number[];
    humidity_history: number[];
  }) => api.post("/crop/predict", data),
};

//
// ================= ELIGIBILITY =================
//
export const eligibilityApi = {
  check: (data: {
    age: number;
    annual_income: number;
    land_size_acres: number;
    category: string;
    state?: string;
  }) => api.post("/eligibility/check", data),
};

//
// ================= COMMUNITY =================
//
export const communityApi = {
  getPosts: (skip?: number, limit?: number) =>
    api.get("/community/posts", { params: { skip, limit } }),
  createPost: (postData: {
    content?: string;
    caption?: string;
    media_type?: string;
    image_url?: string;
    video_url?: string;
    media_urls?: string[];
  }) => api.post("/community/posts", postData),
  likePost: (postId: number) =>
    api.post(`/community/posts/${postId}/like`),
  addComment: (postId: number, content: string) =>
    api.post(`/community/posts/${postId}/comments`, { content }),
  getComments: (postId: number) =>
    api.get(`/community/posts/${postId}/comments`),
  followUser: (userId: number) =>
    api.post(`/community/follow/${userId}`),
  sharePost: (postId: number, platform: string = "in_app") =>
    api.post(`/community/posts/${postId}/share`, { share_platform: platform }),
};

//
// ================= SCHEMES =================
//
export const schemesApi = {
  getAll: (params?: {
    category?: string;
    status?: string;
    state?: string;
    search?: string;
    limit?: number;
    offset?: number;
    language?: Language;
  }) => api.get("/schemes", { params }),
  getById: (id: number) => api.get(`/schemes/${id}`),
  apply: (schemeId: number) => api.post(`/schemes/${schemeId}/apply`),
};

//
// ================= NEWS =================
//
export const newsApi = {
  getAll: () => api.get("/news"),
  getById: (id: number) => api.get(`/news/${id}`),
  getRealTime: (params?: { category?: string; search?: string; limit?: number }) =>
    api.get("/news/realtime", { params }),
};

//
// ================= NOTIFICATIONS =================
//
export const notificationsApi = {
  getAll: (unread_only?: boolean) =>
    api.get("/notifications", { params: { unread_only } }),
  markRead: (id: number, is_read: boolean) =>
    api.put(`/notifications/${id}`, { is_read }),
  markAllRead: () => api.post("/notifications/mark-all-read"),
};

//
// ================= FILE UPLOAD =================
//
export const uploadApi = {
  uploadFile: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    return api.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

//
// ================= DASHBOARD =================
//
export const dashboardApi = {
  getStats: () => api.get("/dashboard/stats"),
};

//
// ================= TRANSLATIONS =================
//
export const translationsApi = {
  get: (language: Language) =>
    api.get(`/translations/${language}`),
};

//
// ================= PROFILE DASHBOARD =================
//
export const profileApi = {
  getDashboard: () => api.get("/profile/dashboard"),
  getActivities: (skip?: number, limit?: number, activity_type?: string) =>
    api.get("/profile/activities", { params: { skip, limit, activity_type } }),
};