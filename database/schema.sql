-- Digital Krishi - MySQL Database Schema

CREATE DATABASE IF NOT EXISTS digital_krishi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE digital_krishi;

-- Users Table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(15) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    location VARCHAR(100),
    language VARCHAR(10) DEFAULT 'en',
    avatar_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_phone (phone),
    INDEX idx_language (language)
) ENGINE=InnoDB;

-- OTP Verification Table
CREATE TABLE otp_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(15) NOT NULL,
    otp VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone_otp (phone, otp),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB;

-- Weather Data Table
CREATE TABLE weather_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    location VARCHAR(100) NOT NULL,
    temperature DECIMAL(5,2),
    `condition` VARCHAR(50),
    humidity INT,
    wind_speed DECIMAL(5,2),
    forecast JSON,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_location (location),
    INDEX idx_recorded_at (recorded_at)
) ENGINE=InnoDB;

-- Market Prices Table
CREATE TABLE market_prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    crop VARCHAR(50) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    market VARCHAR(100) NOT NULL,
    change_percent DECIMAL(5,2),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_crop (crop),
    INDEX idx_market (market),
    INDEX idx_recorded_at (recorded_at)
) ENGINE=InnoDB;

-- Price History Table
CREATE TABLE price_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    crop VARCHAR(50) NOT NULL,
    market VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    recorded_date DATE NOT NULL,
    INDEX idx_crop_market_date (crop, market, recorded_date)
) ENGINE=InnoDB;

-- AI Chat Messages Table
CREATE TABLE chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('user', 'ai') NOT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- Disease Detections Table
CREATE TABLE disease_detections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    detected_disease VARCHAR(100),
    confidence DECIMAL(5,2),
    crop_type VARCHAR(50),
    treatment TEXT,
    prevention TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- ────────────────────────────────────────
-- Tags (global registry - e.g. #wheat, #organic)
-- ────────────────────────────────────────
CREATE TABLE tags (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,
    post_count   INT DEFAULT 0,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tag_name (name),
    INDEX idx_tag_post_count (post_count DESC)
) ENGINE=InnoDB;

-- ────────────────────────────────────────
-- Community Posts (upgraded — Instagram style)
-- ────────────────────────────────────────
CREATE TABLE community_posts (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,

    -- Content
    caption         VARCHAR(500),
    content         TEXT,
    media_type      ENUM('text','image','video','image_video') DEFAULT 'text' NOT NULL,
    image_url       VARCHAR(500),
    video_url       VARCHAR(500),
    thumbnail_url   VARCHAR(500),
    media_urls      JSON,                       -- extra media list

    -- Meta
    location        VARCHAR(200),
    ai_tags         JSON,                       -- AI-suggested tag names
    is_ai_checked   BOOLEAN DEFAULT FALSE,
    status          ENUM('active','flagged','removed','hidden') DEFAULT 'active' NOT NULL,
    flag_reason     VARCHAR(500),

    -- Denormalised engagement counters (fast feed queries)
    likes_count     INT DEFAULT 0,
    comments_count  INT DEFAULT 0,
    shares_count    INT DEFAULT 0,
    saves_count     INT DEFAULT 0,
    views_count     BIGINT DEFAULT 0,

    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_cp_user_id    (user_id),
    INDEX idx_cp_status     (status),
    INDEX idx_cp_created    (created_at DESC),
    INDEX idx_cp_likes      (likes_count DESC),
    INDEX idx_cp_views      (views_count DESC),
    -- Composite index for trending score query
    INDEX idx_cp_trending   (status, likes_count, views_count)
) ENGINE=InnoDB;

-- ────────────────────────────────────────
-- Post Tags (many-to-many: post ↔ tag)
-- ────────────────────────────────────────
CREATE TABLE post_tags (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    post_id  INT NOT NULL,
    tag_id   INT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id)  REFERENCES tags(id)            ON DELETE CASCADE,
    UNIQUE KEY uq_post_tag (post_id, tag_id),
    INDEX idx_pt_tag_id (tag_id)
) ENGINE=InnoDB;

-- ────────────────────────────────────────
-- Post Likes
-- ────────────────────────────────────────
CREATE TABLE post_likes (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    post_id    INT NOT NULL,
    user_id    INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)           ON DELETE CASCADE,
    UNIQUE KEY uq_post_like (post_id, user_id)
) ENGINE=InnoDB;

-- ────────────────────────────────────────
-- Post Comments  (parent_id enables nested replies)
-- ────────────────────────────────────────
CREATE TABLE post_comments (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    post_id     INT NOT NULL,
    user_id     INT NOT NULL,
    parent_id   INT DEFAULT NULL,             -- NULL = top-level comment
    content     TEXT NOT NULL,
    likes_count INT DEFAULT 0,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id)   REFERENCES community_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)   REFERENCES users(id)           ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES post_comments(id)   ON DELETE CASCADE,
    INDEX idx_pc_post_id   (post_id),
    INDEX idx_pc_parent_id (parent_id)
) ENGINE=InnoDB;

-- ────────────────────────────────────────
-- Post Saves / Bookmarks
-- ────────────────────────────────────────
CREATE TABLE post_saves (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    post_id    INT NOT NULL,
    user_id    INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)           ON DELETE CASCADE,
    UNIQUE KEY uq_post_save (post_id, user_id),
    INDEX idx_ps_user_id (user_id)
) ENGINE=InnoDB;

-- ────────────────────────────────────────
-- Post Shares
-- ────────────────────────────────────────
CREATE TABLE post_shares (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    post_id         INT NOT NULL,
    user_id         INT NOT NULL,
    share_platform  VARCHAR(50),              -- 'whatsapp','external','in_app'
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)           ON DELETE CASCADE,
    INDEX idx_psh_post_id (post_id)
) ENGINE=InnoDB;

-- ────────────────────────────────────────
-- Post Views  (engagement / reach tracking)
-- ────────────────────────────────────────
CREATE TABLE post_views (
    id                   BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id              INT NOT NULL,
    user_id              INT DEFAULT NULL,    -- NULL = unauthenticated viewer
    time_spent_seconds   INT DEFAULT 0,       -- seconds on screen
    viewed_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)           ON DELETE SET NULL,
    INDEX idx_pv_post_id  (post_id),
    INDEX idx_pv_viewed   (viewed_at)
) ENGINE=InnoDB;

-- ────────────────────────────────────────
-- User Follows
-- ────────────────────────────────────────
CREATE TABLE user_follows (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    follower_id  INT NOT NULL,
    following_id INT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (follower_id)  REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_follow (follower_id, following_id),
    INDEX idx_uf_following_id (following_id)
) ENGINE=InnoDB;

-- Government Schemes Table
CREATE TABLE government_schemes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    title_hi VARCHAR(200),
    title_ta VARCHAR(200),
    title_te VARCHAR(200),
    title_mr VARCHAR(200),
    description TEXT NOT NULL,
    description_hi TEXT,
    description_ta TEXT,
    description_te TEXT,
    description_mr TEXT,
    eligibility TEXT,
    eligibility_hi TEXT,
    deadline DATE,
    documents_required JSON,
    application_link VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_is_active (is_active),
    INDEX idx_deadline (deadline)
) ENGINE=InnoDB;

-- User Documents Table
CREATE TABLE user_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    file_url VARCHAR(255) NOT NULL,
    file_size VARCHAR(20),
    document_type VARCHAR(50),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- Notifications Table
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'warning', 'success') DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- Expert Consultations Table
CREATE TABLE expert_consultations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    query TEXT NOT NULL,
    status ENUM('pending','assigned','in_progress','resolved','closed') DEFAULT 'pending',
    expert_id INT,
    expert_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Sample Weather Data
INSERT INTO weather_data (location, temperature, weather_condition, humidity, wind_speed, forecast) VALUES
('Pune', 28.5, 'Partly Cloudy', 65, 12.5,
'[{"day":"Mon","temp":29,"condition":"sunny"},{"day":"Tue","temp":30,"condition":"sunny"},{"day":"Wed","temp":27,"condition":"cloudy"},{"day":"Thu","temp":26,"condition":"rainy"},{"day":"Fri","temp":28,"condition":"cloudy"}]');