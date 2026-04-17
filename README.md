# Digital Krishi - Full Stack Application

A comprehensive multilingual AI-powered farmer advisory platform built with **Next.js**, **Python FastAPI**, and **MySQL**.

## 🏗️ Architecture

```
digital-krishi-fullstack/
├── backend/              # Python FastAPI Backend
│   ├── app/             # Application modules
│   │   ├── __init__.py
│   │   ├── auth.py      # JWT Authentication
│   │   ├── database.py  # Database connection
│   │   ├── models.py    # SQLAlchemy models
│   │   ├── schemas.py   # Pydantic schemas
│   │   └── ai_service.py # AI response service
│   ├── main.py          # FastAPI entry point
│   ├── requirements.txt # Python dependencies
│   └── .env.example     # Environment variables template
│
├── frontend/            # Next.js Frontend
│   ├── app/            # Next.js app router
│   │   ├── dashboard/  # Dashboard page
│   │   ├── login/      # Login page
│   │   ├── layout.tsx  # Root layout
│   │   └── globals.css # Global styles
│   ├── components/     # React components
│   │   └── ui/        # UI components
│   ├── lib/           # Utilities & API
│   │   ├── api.ts     # API client
│   │   ├── types.ts   # TypeScript types
│   │   └── utils.ts   # Utility functions
│   ├── package.json   # Node dependencies
│   ├── next.config.js # Next.js config
│   ├── tailwind.config.js # Tailwind config
│   ├── tsconfig.json  # TypeScript config
│   └── .env.example   # Environment variables template
│
├── database/           # Database files
│   └── schema.sql     # MySQL schema
│
└── README.md          # This file
```

## 🚀 Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- MySQL 8.0+

### 1. Database Setup

```bash
# Login to MySQL
mysql -u root -p

# Create database
CREATE DATABASE digital_krishi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Import schema
mysql -u root -p digital_krishi < database/schema.sql
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Edit .env with your database credentials

# Run the server
python main.py
```

Backend will start at `http://localhost:8000`

API Documentation: `http://localhost:8000/docs`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Run development server
npm run dev
```

Frontend will start at `http://localhost:3000`

## 📚 API Endpoints

### Authentication
- `POST /api/auth/otp/send` - Send OTP
- `POST /api/auth/otp/verify` - Verify OTP & Login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile

### Weather
- `GET /api/weather/current` - Get weather data

### Market Prices
- `GET /api/market/prices` - Get market prices
- `GET /api/market/history` - Get price history

### AI Chat
- `POST /api/ai/chat` - Send message to AI
- `GET /api/ai/chat/history` - Get chat history

### Disease Detection
- `POST /api/disease/detect` - Detect disease from image
- `GET /api/disease/history` - Get detection history

### Community
- `GET /api/community/posts` - Get posts
- `POST /api/community/posts` - Create post
- `POST /api/community/posts/{id}/like` - Like/unlike post
- `POST /api/community/posts/{id}/comments` - Add comment

### Government Schemes
- `GET /api/schemes` - Get all schemes
- `GET /api/schemes/{id}` - Get scheme details

### Documents
- `GET /api/documents` - Get user documents
- `POST /api/documents` - Upload document
- `DELETE /api/documents/{id}` - Delete document

### Notifications
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/{id}` - Mark as read
- `POST /api/notifications/mark-all-read` - Mark all read

### Expert Consultation
- `POST /api/consultations` - Create consultation
- `GET /api/consultations` - Get consultations

### Upload
- `POST /api/upload` - Upload file

## 🌍 Multilingual Support

The application supports 5 languages:
- English (en)
- Hindi (hi)
- Tamil (ta)
- Telugu (te)
- Marathi (mr)

## 🔐 Authentication Flow

1. User enters phone number
2. OTP is sent to phone (demo returns OTP in response)
3. User enters OTP
4. Backend verifies OTP and returns JWT token
5. Token is stored in localStorage
6. Token is sent with all subsequent requests

## 🤖 AI Features

### AI Chat Assistant
- Context-aware farming advice
- Multilingual responses
- Crop-specific recommendations
- Market price information
- Weather-related advice

### Disease Detection
- Image-based disease identification
- Treatment recommendations
- Prevention guidelines
- Confidence scoring

## 📊 Database Schema

### Core Tables
- `users` - User accounts
- `otp_verifications` - OTP storage
- `weather_data` - Weather information
- `market_prices` - Current market prices
- `price_history` - Historical price data
- `chat_messages` - AI chat history
- `disease_detections` - Disease detection records
- `community_posts` - Community posts
- `post_likes` - Post likes
- `post_comments` - Post comments
- `government_schemes` - Government schemes
- `user_documents` - User uploaded documents
- `notifications` - User notifications
- `expert_consultations` - Expert consultation requests

## 🛠️ Development

### Adding New Features

1. **Backend:**
   - Add model in `app/models.py`
   - Add schema in `app/schemas.py`
   - Add endpoint in `main.py`

2. **Frontend:**
   - Add type in `lib/types.ts`
   - Add API function in `lib/api.ts`
   - Create/update component

### Environment Variables

**Backend (.env):**
```
MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=digital_krishi
SECRET_KEY=your-secret-key
OPENAI_API_KEY=your-openai-key
```

**Frontend (.env.local):**
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 🚀 Production Deployment

### Backend (Docker)

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend (Vercel/Netlify)

```bash
# Build for production
npm run build

# Deploy to Vercel
vercel --prod
```

## 📄 License

MIT License

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📧 Support

For support, email support@digitalkrishi.com or join our community forum.

---

Built with ❤️ for Indian Farmers
# Digital_Krishi_Full_Stack
