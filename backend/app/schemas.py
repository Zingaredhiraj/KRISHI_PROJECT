from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from enum import Enum

# Enums
class MessageType(str, Enum):
    USER = "user"
    AI = "ai"

class NotificationType(str, Enum):
    INFO = "info"
    WARNING = "warning"
    SUCCESS = "success"

class Language(str, Enum):
    EN = "en"
    HI = "hi"
    TA = "ta"
    TE = "te"
    MR = "mr"

# User Schemas
class UserBase(BaseModel):
    phone: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    location: Optional[str] = None
    language: Language = Language.EN

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    location: Optional[str] = None
    language: Optional[Language] = None
    avatar_url: Optional[str] = None
    profile_photo: Optional[str] = None
    crop_preferences: Optional[List[str]] = None

class UserResponse(UserBase):
    id: int
    avatar_url: Optional[str] = None
    profile_photo: Optional[str] = None
    crop_preferences: Optional[List[str]] = None
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Auth Schemas
class OTPRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)

class OTPVerify(BaseModel):
    phone: str
    otp: str = Field(..., min_length=4, max_length=6)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Weather Schemas
class WeatherForecast(BaseModel):
    day: str
    temp: int
    condition: str

class WeatherDataResponse(BaseModel):
    id: int
    location: str
    temperature: Decimal
    condition: str
    humidity: int
    wind_speed: Decimal
    forecast: List[WeatherForecast]
    recorded_at: datetime
    water_level_suggestion: Optional[str] = None
    fertilizer_suggestion: Optional[str] = None
    
    class Config:
        from_attributes = True

# Market Price Schemas
class MarketPriceResponse(BaseModel):
    id: int
    state: str
    district: Optional[str] = None
    taluka: Optional[str] = None
    market: str
    crop: str
    min_price: Optional[Decimal] = None
    max_price: Optional[Decimal] = None
    modal_price: Decimal
    unit: str
    date: date
    recorded_at: datetime
    
    class Config:
        from_attributes = True

class PriceHistoryResponse(BaseModel):
    day: str
    wheat: Optional[int] = None
    rice: Optional[int] = None
    tomato: Optional[int] = None

# Chat Schemas
class ChatMessageCreate(BaseModel):
    content: str
    image_url: Optional[str] = None

class ChatMessageResponse(BaseModel):
    id: int
    type: MessageType
    content: str
    image_url: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class AIChatRequest(BaseModel):
    message: str
    language: Language = Language.EN
    image_url: Optional[str] = None

class AIChatResponse(BaseModel):
    response: str
    suggestions: List[str]

# Disease Detection Schemas
class DiseaseDetectionCreate(BaseModel):
    image_url: str

class DiseaseDetectionResponse(BaseModel):
    id: int
    image_url: str
    detected_disease: Optional[str]
    confidence: Optional[Decimal]
    crop_type: Optional[str]
    treatment: Optional[str]
    prevention: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

# Crop Prediction Schemas
class CropPredictionRequest(BaseModel):
    soil_type: str
    water_level: str
    temperature_history: List[float]
    humidity_history: List[float]

class CropPredictionResponse(BaseModel):
    recommended_crop: str
    reasoning: str
    best_practices: str


# ── Community: Enums ──────────────────────────────────────────────────────────
class PostMediaType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    IMAGE_VIDEO = "image_video"

class ContentStatus(str, Enum):
    ACTIVE = "active"
    FLAGGED = "flagged"
    REMOVED = "removed"
    HIDDEN = "hidden"

# ── Tags ──────────────────────────────────────────────────────────────────────
class TagResponse(BaseModel):
    id: int
    name: str
    post_count: int
    class Config:
        from_attributes = True

# ── Post Create / Update ───────────────────────────────────────────────────────
class PostCreate(BaseModel):
    caption: Optional[str] = None           # heading
    content: Optional[str] = None           # body text
    media_type: PostMediaType = PostMediaType.TEXT
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    media_urls: Optional[List[str]] = None  # multiple images/videos
    thumbnail_url: Optional[str] = None
    location: Optional[str] = None
    tags: Optional[List[str]] = None        # list of tag names e.g. ["wheat","organic"]

class PostUpdate(BaseModel):
    caption: Optional[str] = None
    content: Optional[str] = None
    location: Optional[str] = None
    tags: Optional[List[str]] = None

# ── Post Response ──────────────────────────────────────────────────────────────
class PostAuthor(BaseModel):
    """Lightweight user info embedded in every post card."""
    id: int
    name: str
    avatar_url: Optional[str] = None
    profile_photo: Optional[str] = None
    location: Optional[str] = None
    class Config:
        from_attributes = True

class PostResponse(BaseModel):
    id: int
    caption: Optional[str] = None
    content: Optional[str] = None
    media_type: str
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    media_urls: Optional[List[str]] = None
    thumbnail_url: Optional[str] = None
    location: Optional[str] = None
    tags: List[str] = []                    # tag name strings
    ai_tags: Optional[List[str]] = None
    status: str
    likes_count: int
    comments_count: int
    shares_count: int
    saves_count: int
    views_count: int
    created_at: datetime
    updated_at: datetime
    user: PostAuthor
    # Per-user state (populated from query context)
    is_liked: bool = False
    is_saved: bool = False
    is_following_author: bool = False
    class Config:
        from_attributes = True

class PostLikeResponse(BaseModel):
    id: int
    post_id: int
    user_id: int
    liked: bool                             # True=liked, False=unliked
    new_count: int
    class Config:
        from_attributes = True

# ── Comments ───────────────────────────────────────────────────────────────────
class CommentCreate(BaseModel):
    content: str
    parent_id: Optional[int] = None         # None = top-level comment

class CommentResponse(BaseModel):
    id: int
    post_id: int
    parent_id: Optional[int] = None
    content: str
    likes_count: int
    created_at: datetime
    user: PostAuthor
    replies: List[Any] = []                 # nested CommentResponse
    class Config:
        from_attributes = True

# ── Saves / Bookmarks ─────────────────────────────────────────────────────────
class SaveResponse(BaseModel):
    post_id: int
    saved: bool
    new_count: int

# ── Shares ────────────────────────────────────────────────────────────────────
class ShareCreate(BaseModel):
    share_platform: Optional[str] = "in_app"  # 'whatsapp','external','in_app'

class ShareResponse(BaseModel):
    post_id: int
    shares_count: int

# ── Views / Engagement tracking ───────────────────────────────────────────────
class ViewTrack(BaseModel):
    post_id: int
    time_spent_seconds: int = 0

# ── Follow ────────────────────────────────────────────────────────────────────
class FollowResponse(BaseModel):
    target_user_id: int
    following: bool                         # True=now following, False=unfollowed
    followers_count: int

# ── Feed ──────────────────────────────────────────────────────────────────────
class FeedResponse(BaseModel):
    posts: List[PostResponse]
    total: int
    page: int
    page_size: int
    has_next: bool

# ── AI tag suggestion ─────────────────────────────────────────────────────────
class AITagSuggestion(BaseModel):
    suggested_tags: List[str]
    is_harmful: bool = False
    harmful_reason: Optional[str] = None

# Government Scheme Schemas
class SchemeResponse(BaseModel):
    id: int
    title: str
    title_hi: Optional[str]
    title_ta: Optional[str]
    title_te: Optional[str]
    title_mr: Optional[str]
    description: str
    description_hi: Optional[str]
    description_ta: Optional[str]
    description_te: Optional[str]
    description_mr: Optional[str]
    eligibility: Optional[str]
    eligibility_hi: Optional[str]
    deadline: Optional[date]
    documents_required: Optional[List[str]]
    application_link: Optional[str]
    
    # Categorization
    category: Optional[str] = "Central"
    status: Optional[str] = "Current"
    state_name: Optional[str] = None
    
    # Eligibility Criteria
    min_age: Optional[int] = None
    max_income: Optional[Decimal] = None
    min_land_acres: Optional[Decimal] = None
    eligible_categories: Optional[str] = None
    
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Eligibility Check Schemas
class EligibilityCheckRequest(BaseModel):
    age: int
    annual_income: Decimal
    land_size_acres: Decimal
    category: str  # General, SC, ST, OBC
    state: Optional[str] = None

class EligibilityCheckResponse(BaseModel):
    eligible_schemes: List[SchemeResponse]
    total_found: int

# Document Schemas
class DocumentCreate(BaseModel):
    name: str
    file_url: str
    file_size: Optional[str] = None
    document_type: Optional[str] = None

class DocumentResponse(BaseModel):
    id: int
    name: str
    file_url: str
    file_size: Optional[str]
    document_type: Optional[str]
    uploaded_at: datetime
    
    class Config:
        from_attributes = True

# Notification Schemas
class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    type: NotificationType
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class NotificationUpdate(BaseModel):
    is_read: bool

# Expert Consultation Schemas
class ConsultationCreate(BaseModel):
    query: str

class ConsultationResponse(BaseModel):
    id: int
    query: str
    status: str
    expert_notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Translation Schemas
class TranslationResponse(BaseModel):
    key: str
    en: str
    hi: Optional[str]
    ta: Optional[str]
    te: Optional[str]
    mr: Optional[str]

# Dashboard Stats
class DashboardStats(BaseModel):
    weather_temp: int
    market_change: str
    community_posts: int
    new_schemes: int

# Upload Response
class UploadResponse(BaseModel):
    url: str
    filename: str
    size: int

# Activity Schemas
class UserActivityResponse(BaseModel):
    id: int
    activity_type: str
    title: str
    description: Optional[str] = None
    activity_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class ActivitySummary(BaseModel):
    total_scans: int = 0
    total_ai_queries: int = 0
    total_community_posts: int = 0
    total_market_searches: int = 0
    total_scheme_views: int = 0
    total_documents: int = 0
    member_since_days: int = 0

class UserProfileDashboard(BaseModel):
    user: UserResponse
    activity_summary: ActivitySummary
    recent_activities: List[UserActivityResponse] = []
    recent_scans: List[Any] = []
    recent_ai_queries: List[Any] = []
    recent_posts: List[Any] = []

class NewsArticleResponse(BaseModel):
    id: int
    title: str
    source: str
    url: str
    image_url: Optional[str] = None
    content: Optional[str] = None
    published_at: datetime
    
    class Config:
        from_attributes = True
